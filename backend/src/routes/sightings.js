// backend/src/routes/sightings.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const { pool } = require('../config/database');
const { authenticateJWT, authorize } = require('../middleware/auth');

const upload = multer({ dest: 'uploads/sightings/' });

async function resolveGuideProfileId(userId) {
    const result = await pool.query(
        'SELECT tourguide_id FROM tour_guides WHERE user_id = $1 LIMIT 1',
        [userId]
    );
    return result.rows[0]?.tourguide_id || null;
}

async function resolveTouristProfileId(userId) {
    const result = await pool.query(
        'SELECT tourist_id FROM tourists WHERE user_id = $1 LIMIT 1',
        [userId]
    );
    return result.rows[0]?.tourist_id || null;
}

// =====================================================
// POST /api/sightings
// Report a wildlife sighting
// =====================================================
router.post('/', authenticateJWT, [
    body('animal_id').isUUID(),
    body('location_id').isUUID(),
    body('number_observed').isInt({ min: 1, max: 100 }),
    body('behavior').optional().trim(),
    body('notes').optional().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { animal_id, location_id, number_observed, behavior, photo_urls, notes, tour_session_id } = req.body;
    const userId = req.user.user_id;
    const userType = req.user.user_type;

    try {
        let result;
        if (userType === 'guide') {
            const guideId = await resolveGuideProfileId(userId);
            if (!guideId) {
                return res.status(404).json({ error: 'Guide profile not found' });
            }
            result = await pool.query(
                `INSERT INTO sightings (
                    sighting_id, animal_id, location_id, tourguide_id, toursession_id,
                    number_observed, behavior, photo_urls, notes, verification_status
                 )
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 'verified')
                 RETURNING sighting_id, verification_status`,
                [animal_id, location_id, guideId, tour_session_id || null, number_observed, behavior, photo_urls || [], notes]
            );
        } else {
            const touristId = await resolveTouristProfileId(userId);
            result = await pool.query(
                `INSERT INTO sightings (
                    sighting_id, animal_id, location_id, tourist_id, reported_by_tourist, toursession_id,
                    number_observed, behavior, photo_urls, notes, verification_status
                 )
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
                 RETURNING sighting_id, verification_status`,
                [animal_id, location_id, touristId, userId, tour_session_id || null, number_observed, behavior, photo_urls || [], notes]
            );
        }

        res.status(201).json({
            sighting_id: result.rows[0].sighting_id,
            status: result.rows[0].verification_status,
            message: 'Sighting reported successfully'
        });

    } catch (error) {
        console.error('Report sighting error:', error);
        res.status(500).json({ error: 'Failed to report sighting' });
    }
});

// =====================================================
// GET /api/sightings/recent
// Get recent sightings near a location
// =====================================================
router.get('/recent', authenticateJWT, async (req, res) => {
    const { lat, lng, radius = 5, limit = 20 } = req.query;

    try {
        let query = `
            SELECT s.sighting_id, s.timestamp, s.number_observed, s.behavior,
                   a.name as animal_name, a.conservation_status,
                   l.name as location_name, l.location_type,
                   CASE 
                       WHEN s.tourguide_id IS NOT NULL THEN 'guide'
                       WHEN s.tourist_id IS NOT NULL OR s.reported_by_tourist IS NOT NULL THEN 'tourist'
                       ELSE 'unknown'
                   END as reported_by,
                   s.verification_status, s.photo_urls
            FROM sightings s
            JOIN animals a ON s.animal_id = a.animal_id
            JOIN locations l ON s.location_id = l.location_id
            WHERE s.verification_status = 'verified'
        `;
        const params = [];
        let paramIndex = 1;

        if (lat && lng) {
            query += ` AND ST_DWithin(l.coordinates, ST_SetSRID(ST_MakePoint($${paramIndex++}, $${paramIndex++}), 4326), $${paramIndex++})`;
            params.push(lng, lat, radius * 1000);
        }

        query += ` ORDER BY s.timestamp DESC LIMIT $${paramIndex++}`;
        params.push(limit);

        const result = await pool.query(query, params);

        res.json(result.rows);

    } catch (error) {
        console.error('Get recent sightings error:', error);
        res.status(500).json({ error: 'Failed to fetch sightings' });
    }
});

// =====================================================
// GET /api/sightings/mine
// Get user's own sightings
// =====================================================
router.get('/mine', authenticateJWT, async (req, res) => {
    const userId = req.user.user_id;
    const userType = req.user.user_type;

    try {
        const profileId = userType === 'guide'
            ? await resolveGuideProfileId(userId)
            : await resolveTouristProfileId(userId);

        if (userType === 'guide' && !profileId) {
            return res.status(404).json({ error: 'Guide profile not found' });
        }

        const result = await pool.query(
            `SELECT s.sighting_id, s.timestamp, s.number_observed, s.behavior,
                    a.name as animal_name, a.conservation_status,
                    l.name as location_name,
                    s.verification_status, s.photo_urls, s.notes
             FROM sightings s
             JOIN animals a ON s.animal_id = a.animal_id
             JOIN locations l ON s.location_id = l.location_id
             WHERE ${userType === 'guide' ? 's.tourguide_id' : '(s.tourist_id = $1 OR s.reported_by_tourist = $2)'}
             ORDER BY s.timestamp DESC`,
            userType === 'guide' ? [profileId] : [profileId, userId]
        );

        res.json(result.rows);

    } catch (error) {
        console.error('Get user sightings error:', error);
        res.status(500).json({ error: 'Failed to fetch sightings' });
    }
});

// =====================================================
// GET /api/sightings/stats
// Get sighting statistics
// =====================================================
router.get('/stats', authenticateJWT, async (req, res) => {
    try {
        const total = await pool.query('SELECT COUNT(*) FROM sightings WHERE verification_status = \'verified\'');
        const topAnimals = await pool.query(
            `SELECT a.name, COUNT(*) as count
             FROM sightings s
             JOIN animals a ON s.animal_id = a.animal_id
             WHERE s.verification_status = 'verified'
             GROUP BY a.animal_id, a.name
             ORDER BY count DESC
             LIMIT 5`
        );
        const recentTrend = await pool.query(
            `SELECT DATE(timestamp) as date, COUNT(*) as count
             FROM sightings
             WHERE verification_status = 'verified'
               AND timestamp > NOW() - INTERVAL '30 days'
             GROUP BY DATE(timestamp)
             ORDER BY date`
        );

        res.json({
            total: parseInt(total.rows[0].count),
            topAnimals: topAnimals.rows,
            recentTrend: recentTrend.rows
        });

    } catch (error) {
        console.error('Get sighting stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// =====================================================
// PUT /api/sightings/:id/verify (Guide/Admin only)
// Verify a sighting
// =====================================================
router.put('/:id/verify', authenticateJWT, authorize('guide', 'it_manager'), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['verified', 'flagged'].includes(status)) {
        return res.status(400).json({ error: 'Invalid verification status' });
    }

    try {
        await pool.query(
            `UPDATE sightings SET verification_status = $1, verification_notes = $2
             WHERE sighting_id = $3`,
            [status, `Verified by ${req.user.user_type} on ${new Date().toISOString()}`, id]
        );

        res.json({ success: true, message: `Sighting ${status}` });

    } catch (error) {
        console.error('Verify sighting error:', error);
        res.status(500).json({ error: 'Failed to verify sighting' });
    }
});

// =====================================================
// POST /api/sightings/:id/photos
// Upload photo for a sighting
// =====================================================
router.post('/:id/photos', authenticateJWT, upload.array('photos', 5), async (req, res) => {
    const { id } = req.params;
    const files = req.files;

    if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No photos uploaded' });
    }

    try {
        const photoUrls = files.map(f => `/uploads/sightings/${f.filename}`);

        await pool.query(
            `UPDATE sightings
             SET photo_urls = array_cat(COALESCE(photo_urls, ARRAY[]::TEXT[]), $1::TEXT[])
             WHERE sighting_id = $2`,
            [photoUrls, id]
        );

        res.json({ success: true, photo_urls: photoUrls });

    } catch (error) {
        console.error('Upload photo error:', error);
        res.status(500).json({ error: 'Failed to upload photos' });
    }
});

module.exports = router;
