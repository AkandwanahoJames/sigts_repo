// backend/src/routes/sightings.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const { pool } = require('../config/database');
const { authenticateJWT, authorize } = require('../middleware/auth');

const upload = multer({ dest: 'uploads/sightings/' });
let commentsTableEnsured = false;
let rareAlertsTableEnsured = false;

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

async function ensureCommentsTable() {
    if (commentsTableEnsured) return;
    await pool.query(`
        CREATE TABLE IF NOT EXISTS sighting_comments (
            comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sighting_id UUID NOT NULL REFERENCES sightings(sighting_id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
            comment_text TEXT NOT NULL CHECK (char_length(comment_text) BETWEEN 1 AND 1200),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_sighting_comments_sighting_created ON sighting_comments(sighting_id, created_at DESC)');
    commentsTableEnsured = true;
}

async function ensureRareAlertsTable() {
    if (rareAlertsTableEnsured) return;
    await pool.query(`
        CREATE TABLE IF NOT EXISTS sighting_rare_alerts (
            alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sighting_id UUID NOT NULL REFERENCES sightings(sighting_id) ON DELETE CASCADE,
            animal_id UUID NOT NULL REFERENCES animals(animal_id) ON DELETE CASCADE,
            risk_level VARCHAR(32) NOT NULL,
            reason TEXT NOT NULL,
            triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
            acknowledged_at TIMESTAMP WITH TIME ZONE,
            acknowledged_by UUID REFERENCES users(user_id)
        )
    `);
    await pool.query('CREATE INDEX IF NOT EXISTS idx_sighting_rare_alerts_triggered ON sighting_rare_alerts(triggered_at DESC)');
    await pool.query('ALTER TABLE sighting_rare_alerts ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN NOT NULL DEFAULT FALSE');
    await pool.query('ALTER TABLE sighting_rare_alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITH TIME ZONE');
    await pool.query('ALTER TABLE sighting_rare_alerts ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES users(user_id)');
    rareAlertsTableEnsured = true;
}

function getRareRiskLevel(conservationStatus = '', observedCount = 0) {
    const status = String(conservationStatus || '').toLowerCase();
    if (status.includes('critical')) return 'critical';
    if (status.includes('endangered')) return observedCount <= 2 ? 'critical' : 'high';
    if (status.includes('vulnerable') && observedCount <= 2) return 'high';
    return null;
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
        let rareAlert = null;
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

        try {
            const animalInfo = await pool.query(
                'SELECT animal_id, name, conservation_status FROM animals WHERE animal_id = $1 LIMIT 1',
                [animal_id]
            );
            const animal = animalInfo.rows[0];
            const riskLevel = getRareRiskLevel(animal?.conservation_status, Number(number_observed || 0));
            if (animal && riskLevel) {
                await ensureRareAlertsTable();
                const reason = `${animal.name} (${animal.conservation_status || 'unknown'}) observed with count ${number_observed}`;
                const alertInsert = await pool.query(
                    `INSERT INTO sighting_rare_alerts (alert_id, sighting_id, animal_id, risk_level, reason)
                     VALUES (gen_random_uuid(), $1, $2, $3, $4)
                     RETURNING alert_id, risk_level, reason, triggered_at`,
                    [result.rows[0].sighting_id, animal.animal_id, riskLevel, reason]
                );
                rareAlert = {
                    ...alertInsert.rows[0],
                    animal_name: animal.name,
                    conservation_status: animal.conservation_status
                };
            }
        } catch (alertError) {
            console.warn('Rare alert evaluation skipped:', alertError.message);
        }

        res.status(201).json({
            sighting_id: result.rows[0].sighting_id,
            status: result.rows[0].verification_status,
            message: 'Sighting reported successfully',
            rare_alert: rareAlert
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
// GET /api/sightings/alerts/rare
// Get latest rare sighting alerts
// =====================================================
router.get('/alerts/rare', authenticateJWT, authorize('guide', 'it_manager'), async (req, res) => {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));
    const unackedOnly = String(req.query.unacked || '').toLowerCase() === 'true';
    try {
        await ensureRareAlertsTable();
        const result = await pool.query(
            `SELECT r.alert_id, r.sighting_id, r.risk_level, r.reason, r.triggered_at,
                    r.acknowledged, r.acknowledged_at, r.acknowledged_by,
                    a.name AS animal_name, a.conservation_status,
                    s.number_observed, l.name AS location_name
             FROM sighting_rare_alerts r
             JOIN sightings s ON s.sighting_id = r.sighting_id
             JOIN animals a ON a.animal_id = r.animal_id
             JOIN locations l ON l.location_id = s.location_id
             ${unackedOnly ? 'WHERE r.acknowledged = FALSE' : ''}
             ORDER BY r.triggered_at DESC
             LIMIT $1`,
            [limit]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get rare alerts error:', error);
        res.status(500).json({ error: 'Failed to fetch rare alerts' });
    }
});

// =====================================================
// PUT /api/sightings/alerts/rare/:alertId/ack
// Acknowledge a rare sighting alert
// =====================================================
router.put('/alerts/rare/:alertId/ack', authenticateJWT, authorize('it_manager'), async (req, res) => {
    const { alertId } = req.params;
    try {
        await ensureRareAlertsTable();
        const result = await pool.query(
            `UPDATE sighting_rare_alerts
             SET acknowledged = TRUE,
                 acknowledged_at = CURRENT_TIMESTAMP,
                 acknowledged_by = $1
             WHERE alert_id = $2
             RETURNING alert_id, acknowledged, acknowledged_at`,
            [req.user.user_id, alertId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Alert not found' });
        res.json({ success: true, alert: result.rows[0] });
    } catch (error) {
        console.error('Acknowledge rare alert error:', error);
        res.status(500).json({ error: 'Failed to acknowledge alert' });
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

// =====================================================
// GET /api/sightings/:id/comments
// Get comments thread for a sighting
// =====================================================
router.get('/:id/comments', authenticateJWT, async (req, res) => {
    const { id } = req.params;
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));
    try {
        await ensureCommentsTable();
        const result = await pool.query(
            `SELECT c.comment_id, c.sighting_id, c.comment_text, c.created_at,
                    u.user_id, u.username, u.full_name, u.user_type
             FROM sighting_comments c
             JOIN users u ON u.user_id = c.user_id
             WHERE c.sighting_id = $1
             ORDER BY c.created_at DESC
             LIMIT $2`,
            [id, limit]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Get sighting comments error:', error);
        res.status(500).json({ error: 'Failed to fetch sighting comments' });
    }
});

// =====================================================
// POST /api/sightings/:id/comments
// Add comment to a sighting
// =====================================================
router.post('/:id/comments', authenticateJWT, [
    body('comment_text').isString().trim().isLength({ min: 1, max: 1200 })
], async (req, res) => {
    const { id } = req.params;
    const { comment_text } = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
        await ensureCommentsTable();
        const sightingExists = await pool.query('SELECT 1 FROM sightings WHERE sighting_id = $1 LIMIT 1', [id]);
        if (!sightingExists.rows.length) return res.status(404).json({ error: 'Sighting not found' });
        const inserted = await pool.query(
            `INSERT INTO sighting_comments (comment_id, sighting_id, user_id, comment_text)
             VALUES (gen_random_uuid(), $1, $2, $3)
             RETURNING comment_id, sighting_id, comment_text, created_at`,
            [id, req.user.user_id, comment_text.trim()]
        );
        res.status(201).json({ success: true, comment: inserted.rows[0] });
    } catch (error) {
        console.error('Add sighting comment error:', error);
        res.status(500).json({ error: 'Failed to add sighting comment' });
    }
});

module.exports = router;
