// backend/src/routes/cultural.js
const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateJWT, authorize } = require('../middleware/auth');

// =====================================================
// GET /api/cultural
// Get all cultural stories
// =====================================================
router.get('/', authenticateJWT, [
    query('community').optional().isIn(['batwa', 'bakiga', 'banyarwanda', 'other']),
    query('type').optional().isIn(['myth', 'history', 'tradition', 'music', 'proverb']),
    query('limit').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
    const { community, type, limit = 20, offset = 0 } = req.query;

    try {
        let query = `
            SELECT narrative_id, title_en, title_local, community, story_type,
                   storyteller_name, storyteller_photo_url, audio_url, image_urls,
                   verified_by_community, duration,
                   CASE WHEN verified_by_community THEN '✅ Verified' ELSE '⏳ Pending' END as verification_badge
            FROM cultural_narratives
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (community) {
            query += ` AND community = $${paramIndex++}`;
            params.push(community);
        }

        if (type) {
            query += ` AND story_type = $${paramIndex++}`;
            params.push(type);
        }

        query += ` ORDER BY verified_by_community DESC, created_at DESC
                   LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        res.json({
            stories: result.rows,
            total: result.rowCount,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('Get cultural stories error:', error);
        res.status(500).json({ error: 'Failed to fetch stories' });
    }
});

// =====================================================
// GET /api/cultural/:id
// Get cultural story by ID
// =====================================================
router.get('/:id', authenticateJWT, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `SELECT c.*, 
                    array_agg(DISTINCT l.name) FILTER (WHERE l.name IS NOT NULL) as related_locations,
                    array_agg(DISTINCT l.location_id) FILTER (WHERE l.location_id IS NOT NULL) as location_ids,
                    array_agg(DISTINCT a.name) FILTER (WHERE a.name IS NOT NULL) as related_animals,
                    array_agg(DISTINCT a.animal_id) FILTER (WHERE a.animal_id IS NOT NULL) as animal_ids
             FROM cultural_narratives c
             LEFT JOIN cultural_locations cl ON c.narrative_id = cl.narrative_id
             LEFT JOIN locations l ON cl.location_id = l.location_id
             LEFT JOIN cultural_animals ca ON c.narrative_id = ca.narrative_id
             LEFT JOIN animals a ON ca.animal_id = a.animal_id
             WHERE c.narrative_id = $1
             GROUP BY c.narrative_id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Story not found' });
        }

        // Increment view count
        await pool.query(
            'UPDATE cultural_narratives SET view_count = COALESCE(view_count, 0) + 1 WHERE narrative_id = $1',
            [id]
        );

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Get cultural story error:', error);
        res.status(500).json({ error: 'Failed to fetch story' });
    }
});

// =====================================================
// GET /api/cultural/storytellers/:id
// Get storyteller profile
// =====================================================
router.get('/storytellers/:id', authenticateJWT, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `SELECT storyteller_name, storyteller_photo_url, community,
                    COUNT(*) as stories_count,
                    array_agg(title_en) as story_titles
             FROM cultural_narratives
             WHERE storyteller_name ILIKE $1 OR community = $1
             GROUP BY storyteller_name, storyteller_photo_url, community`,
            [`%${id}%`]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Storyteller not found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Get storyteller error:', error);
        res.status(500).json({ error: 'Failed to fetch storyteller' });
    }
});

// =====================================================
// POST /api/cultural (Admin/Curator only)
// Create new cultural story
// =====================================================
router.post('/', authenticateJWT, authorize('it_manager'), [
    body('title_en').notEmpty(),
    body('narrative_en').notEmpty(),
    body('community').isIn(['batwa', 'bakiga', 'banyarwanda', 'other']),
    body('story_type').isIn(['myth', 'history', 'tradition', 'music', 'proverb']),
    body('storyteller_name').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { title_en, title_local, narrative_en, narrative_local, storyteller_name, storyteller_photo_url,
            community, story_type, audio_url, video_url, image_urls, cultural_significance, taboos } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO cultural_narratives (
                narrative_id, title_en, title_local, narrative_en, narrative_local,
                storyteller_name, storyteller_photo_url, community, story_type,
                audio_url, video_url, image_urls, cultural_significance, taboos,
                user_id, created_at
             ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP
             ) RETURNING narrative_id`,
            [title_en, title_local, narrative_en, narrative_local, storyteller_name, storyteller_photo_url,
             community, story_type, audio_url, video_url, image_urls || [], cultural_significance, taboos,
             req.user.user_id]
        );

        res.status(201).json({
            success: true,
            narrative_id: result.rows[0].narrative_id,
            message: 'Story created successfully'
        });

    } catch (error) {
        console.error('Create story error:', error);
        res.status(500).json({ error: 'Failed to create story' });
    }
});

// =====================================================
// PUT /api/cultural/:id/verify (Admin only)
// Verify a cultural story
// =====================================================
router.put('/:id/verify', authenticateJWT, authorize('it_manager'), async (req, res) => {
    const { id } = req.params;
    const { verified } = req.body;

    try {
        await pool.query(
            `UPDATE cultural_narratives 
             SET verified_by_community = $1, verification_date = CURRENT_DATE
             WHERE narrative_id = $2`,
            [verified, id]
        );

        res.json({ success: true, message: verified ? 'Story verified' : 'Verification removed' });

    } catch (error) {
        console.error('Verify story error:', error);
        res.status(500).json({ error: 'Failed to verify story' });
    }
});

module.exports = router;
