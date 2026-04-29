// backend/src/routes/tours.js
const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateJWT, authorize } = require('../middleware/auth');

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

async function hasTable(tableName) {
    const result = await pool.query(
        `SELECT 1
         FROM pg_tables
         WHERE schemaname = 'public' AND tablename = $1`,
        [tableName]
    );
    return result.rows.length > 0;
}

async function hasTourSchedulingTables() {
    const [sessions, participants] = await Promise.all([
        hasTable('tour_sessions'),
        hasTable('tour_participants')
    ]);
    return sessions && participants;
}

// =====================================================
// GET /api/tours/schedule (Guide only)
// Get tour schedule for a guide
// =====================================================
router.get('/schedule', authenticateJWT, authorize('guide'), async (req, res) => {
    const guideId = await resolveGuideProfileId(req.user.user_id);
    const { date, start, end } = req.query;

    try {
        if (!(await hasTourSchedulingTables())) {
            return res.json([]);
        }

        if (!guideId) {
            return res.status(404).json({ error: 'Guide profile not found' });
        }

        let query = `
            SELECT ts.tour_session_id, ts.scheduled_start, ts.actual_start, ts.actual_end,
                   ts.status, ts.group_size, ts.special_requests,
                   tr.name as route_name, tr.difficulty, tr.distance_km,
                   COUNT(tp.tourist_id) as confirmed_guests
            FROM tour_sessions ts
            JOIN tour_routes tr ON ts.route_id = tr.route_id
            LEFT JOIN tour_participants tp ON ts.tour_session_id = tp.tour_session_id
            WHERE ts.tourguide_id = $1
        `;
        const params = [guideId];
        let paramIndex = 2;

        if (date) {
            query += ` AND DATE(ts.scheduled_start) = $${paramIndex++}`;
            params.push(date);
        }

        if (start && end) {
            query += ` AND ts.scheduled_start BETWEEN $${paramIndex++} AND $${paramIndex++}`;
            params.push(start, end);
        }

        query += ` GROUP BY ts.tour_session_id, tr.name, tr.difficulty, tr.distance_km
                   ORDER BY ts.scheduled_start ASC`;

        const result = await pool.query(query, params);

        res.json(result.rows);

    } catch (error) {
        console.error('Get schedule error:', error);
        res.status(500).json({ error: 'Failed to fetch schedule' });
    }
});

// =====================================================
// GET /api/tours/:id
// Get tour details by ID
// =====================================================
router.get('/:id', authenticateJWT, async (req, res) => {
    const { id } = req.params;

    try {
        if (!(await hasTourSchedulingTables())) {
            return res.status(503).json({ error: 'Tour scheduling is unavailable until database migrations are applied' });
        }

        const tourResult = await pool.query(
            `SELECT ts.*, tr.name as route_name, tr.description as route_description,
                    tr.difficulty, tr.distance_km, tr.duration_hours,
                    u.first_name, u.last_name, u.profile_pic_url
             FROM tour_sessions ts
             JOIN tour_routes tr ON ts.route_id = tr.route_id
             JOIN tour_guides tg ON ts.tourguide_id = tg.tourguide_id
             JOIN users u ON tg.user_id = u.user_id
             WHERE ts.tour_session_id = $1`,
            [id]
        );

        if (tourResult.rows.length === 0) {
            return res.status(404).json({ error: 'Tour not found' });
        }

        const tour = tourResult.rows[0];

        const role = req.user?.user_type;
        if (role === 'it_manager') {
            // full access
        } else if (role === 'guide') {
            const guideId = await resolveGuideProfileId(req.user.user_id);
            if (!guideId || tour.tourguide_id !== guideId) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied',
                    message: 'You can only view tours assigned to you.'
                });
            }
        } else {
            const touristId = await resolveTouristProfileId(req.user.user_id);
            if (!touristId) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied',
                    message: 'Tourist profile required to view tour details.'
                });
            }
            const access = await pool.query(
                `SELECT 1 FROM tour_participants
                 WHERE tour_session_id = $1 AND tourist_id = $2
                 LIMIT 1`,
                [id, touristId]
            );
            if (access.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    error: 'Access denied',
                    message: 'You can only view tours you are registered on.'
                });
            }
        }

        // Get participants
        const participantsResult = await pool.query(
            `SELECT tp.*, u.username, u.first_name, u.last_name, u.profile_pic_url,
                    t.nationality, t.interests
             FROM tour_participants tp
             JOIN tourists t ON tp.tourist_id = t.tourist_id
             JOIN users u ON t.user_id = u.user_id
             WHERE tp.tour_session_id = $1`,
            [id]
        );

        tour.participants = participantsResult.rows;

        // Get route waypoints
        const waypointsResult = await pool.query(
            `SELECT rl.stop_order, rl.estimated_time_from_prev, rl.stop_duration,
                    l.name, l.location_type, l.description,
                    ST_X(l.coordinates) as longitude, ST_Y(l.coordinates) as latitude
             FROM route_locations rl
             JOIN locations l ON rl.location_id = l.location_id
             WHERE rl.route_id = $1
             ORDER BY rl.stop_order`,
            [tour.route_id]
        );

        tour.waypoints = waypointsResult.rows;

        res.json(tour);

    } catch (error) {
        console.error('Get tour details error:', error);
        res.status(500).json({ error: 'Failed to fetch tour details' });
    }
});

// =====================================================
// PUT /api/tours/:id/start (Guide only)
// Start a tour
// =====================================================
router.put('/:id/start', authenticateJWT, authorize('guide'), async (req, res) => {
    const { id } = req.params;
    const guideId = await resolveGuideProfileId(req.user.user_id);
    const { current_lat, current_lng } = req.body;

    try {
        if (!(await hasTourSchedulingTables())) {
            return res.status(503).json({ error: 'Tour scheduling is unavailable until database migrations are applied' });
        }

        if (!guideId) {
            return res.status(404).json({ error: 'Guide profile not found' });
        }

        const result = await pool.query(
            `UPDATE tour_sessions 
             SET status = 'ongoing', 
                 actual_start = CURRENT_TIMESTAMP,
                 current_lat = COALESCE($1, current_lat),
                 current_lng = COALESCE($2, current_lng),
                 last_location_update = CURRENT_TIMESTAMP
             WHERE tour_session_id = $3 AND tourguide_id = $4
             RETURNING tour_session_id`,
            [current_lat, current_lng, id, guideId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tour not found or not assigned to you' });
        }

        // Get WebSocket instance and notify participants
        const io = req.app.get('io');
        io.to(`tour:${id}`).emit('tour-started', { tourId: id, startTime: new Date().toISOString() });

        res.json({ success: true, message: 'Tour started', tour_session_id: result.rows[0].tour_session_id });

    } catch (error) {
        console.error('Start tour error:', error);
        res.status(500).json({ error: 'Failed to start tour' });
    }
});

// =====================================================
// PUT /api/tours/:id/end (Guide only)
// End a tour
// =====================================================
router.put('/:id/end', authenticateJWT, authorize('guide'), async (req, res) => {
    const { id } = req.params;
    const guideId = await resolveGuideProfileId(req.user.user_id);
    const { guide_notes } = req.body;

    try {
        if (!(await hasTourSchedulingTables())) {
            return res.status(503).json({ error: 'Tour scheduling is unavailable until database migrations are applied' });
        }

        if (!guideId) {
            return res.status(404).json({ error: 'Guide profile not found' });
        }

        const result = await pool.query(
            `UPDATE tour_sessions 
             SET status = 'completed', 
                 actual_end = CURRENT_TIMESTAMP,
                 guide_notes = COALESCE($1, guide_notes)
             WHERE tour_session_id = $2 AND tourguide_id = $3
             RETURNING tour_session_id, actual_start, actual_end`,
            [guide_notes, id, guideId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tour not found or not assigned to you' });
        }

        const tour = result.rows[0];
        const duration = Math.round((new Date(tour.actual_end) - new Date(tour.actual_start)) / 60000);

        // Update guide stats
        await pool.query(
            `UPDATE tour_guides 
             SET total_tours_conducted = total_tours_conducted + 1
             WHERE tourguide_id = $1`,
            [guideId]
        );

        const io = req.app.get('io');
        io.to(`tour:${id}`).emit('tour-ended', { tourId: id, duration });

        // Generate tour summary
        const sightings = await pool.query(
            `SELECT COUNT(*) as total_sightings,
                    COUNT(DISTINCT animal_id) as unique_species
             FROM sightings
             WHERE toursession_id = $1`,
            [id]
        );

        res.json({
            success: true,
            message: 'Tour completed',
            duration_minutes: duration,
            summary: sightings.rows[0]
        });

    } catch (error) {
        console.error('End tour error:', error);
        res.status(500).json({ error: 'Failed to end tour' });
    }
});

// =====================================================
// POST /api/tours/:id/location (Guide only)
// Update tour location (real-time tracking)
// =====================================================
router.post('/:id/location', authenticateJWT, authorize('guide'), [
    body('lat').isFloat(),
    body('lng').isFloat()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { lat, lng } = req.body;
    const guideId = await resolveGuideProfileId(req.user.user_id);

    try {
        if (!(await hasTourSchedulingTables())) {
            return res.status(503).json({ error: 'Tour scheduling is unavailable until database migrations are applied' });
        }

        if (!guideId) {
            return res.status(404).json({ error: 'Guide profile not found' });
        }

        await pool.query(
            `UPDATE tour_sessions 
             SET current_lat = $1, current_lng = $2, last_location_update = CURRENT_TIMESTAMP
             WHERE tour_session_id = $3 AND tourguide_id = $4 AND status = 'ongoing'`,
            [lat, lng, id, guideId]
        );

        const io = req.app.get('io');
        io.to(`tour:${id}`).emit('tour-location', { tourId: id, lat, lng, timestamp: new Date().toISOString() });

        res.json({ success: true });

    } catch (error) {
        console.error('Update location error:', error);
        res.status(500).json({ error: 'Failed to update location' });
    }
});

// =====================================================
// POST /api/tours/:id/notes (Guide only)
// Add tour notes
// =====================================================
router.post('/:id/notes', authenticateJWT, authorize('guide'), [
    body('notes').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { notes } = req.body;

    try {
        if (!(await hasTourSchedulingTables())) {
            return res.status(503).json({ error: 'Tour scheduling is unavailable until database migrations are applied' });
        }

        await pool.query(
            `UPDATE tour_sessions 
             SET guide_notes = COALESCE(guide_notes, '') || E'\n' || $1
             WHERE tour_session_id = $2`,
            [notes, id]
        );

        res.json({ success: true, message: 'Notes added' });

    } catch (error) {
        console.error('Add notes error:', error);
        res.status(500).json({ error: 'Failed to add notes' });
    }
});

module.exports = router;
