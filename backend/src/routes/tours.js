// backend/src/routes/tours.js
const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateJWT, authorize } = require('../middleware/auth');
const { redactMedicalNotes } = require('../services/medicalNotesAccess');

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

async function getTourForGuideOrThrow(tourSessionId, guideUserId) {
    const guideId = await resolveGuideProfileId(guideUserId);
    if (!guideId) {
        return { error: { status: 404, payload: { error: 'Guide profile not found' } } };
    }
    const tour = await pool.query(
        `SELECT ts.*, tr.name AS route_name, tr.distance_km, tr.duration_hours, tr.difficulty
         FROM tour_sessions ts
         JOIN tour_routes tr ON tr.route_id = ts.route_id
         WHERE ts.tour_session_id = $1 AND ts.tourguide_id = $2`,
        [tourSessionId, guideId]
    );
    if (!tour.rows.length) {
        return { error: { status: 404, payload: { error: 'Tour not found or not assigned to you' } } };
    }
    return { guideId, tour: tour.rows[0] };
}

async function defaultParkId() {
    const r = await pool.query(`SELECT park_id FROM parks ORDER BY created_at ASC NULLS LAST LIMIT 1`);
    return r.rows[0]?.park_id || null;
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
// GET /api/tours/routes (Guide + IT manager)
// =====================================================
router.get('/routes', authenticateJWT, authorize('guide', 'it_manager'), async (req, res) => {
    try {
        const rows = await pool.query(
            `SELECT route_id, name, description, distance_km, duration_hours, difficulty
             FROM tour_routes
             ORDER BY name ASC`
        );
        return res.json({ routes: rows.rows });
    } catch (error) {
        console.error('list routes', error);
        return res.status(500).json({ error: 'Failed to load routes' });
    }
});

// =====================================================
// GET /api/tours/guides (IT manager)
// =====================================================
router.get('/guides', authenticateJWT, authorize('it_manager'), async (req, res) => {
    try {
        const rows = await pool.query(
            `SELECT tg.tourguide_id, tg.user_id, tg.license_number, tg.certification_level,
                    tg.languages, tg.years_of_experience, tg.is_active,
                    u.username, u.first_name, u.last_name, u.email
             FROM tour_guides tg
             JOIN users u ON u.user_id = tg.user_id
             WHERE tg.is_active = true AND u.is_active = true
             ORDER BY u.first_name NULLS LAST, u.last_name NULLS LAST, u.username`
        );
        return res.json({ guides: rows.rows });
    } catch (error) {
        console.error('list guides', error);
        return res.status(500).json({ error: 'Failed to load guides' });
    }
});

// =====================================================
// POST /api/tours/assignments (IT manager)
// Create one tour assignment for a guide
// =====================================================
router.post('/assignments', authenticateJWT, authorize('it_manager'), [
    body('guide_user_id').isUUID(),
    body('route_id').isUUID(),
    body('scheduled_start').isISO8601(),
    body('group_size').optional().isInt({ min: 1, max: 200 }),
    body('vehicle_used').optional().isString(),
    body('special_requests').optional().isString(),
    body('park_id').optional().isUUID()
], async (req, res) => {
    try {
        if (!(await hasTourSchedulingTables())) {
            return res.status(503).json({ error: 'Tour scheduling is unavailable until database migrations are applied' });
        }
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const guideProfile = await pool.query(
            `SELECT tourguide_id FROM tour_guides
             WHERE user_id = $1 AND is_active = true`,
            [req.body.guide_user_id]
        );
        if (!guideProfile.rows.length) return res.status(404).json({ error: 'Guide not found or inactive' });

        const routeExists = await pool.query(`SELECT route_id FROM tour_routes WHERE route_id = $1`, [req.body.route_id]);
        if (!routeExists.rows.length) return res.status(404).json({ error: 'Route not found' });

        const parkId = req.body.park_id || (await defaultParkId());
        if (!parkId) return res.status(400).json({ error: 'No park available. Provide park_id or seed parks.' });

        const ins = await pool.query(
            `INSERT INTO tour_sessions (
                scheduled_start, status, group_size, vehicle_used, special_requests,
                tourguide_id, route_id, park_id
            ) VALUES (
                $1, 'scheduled', $2, $3, $4, $5, $6, $7
            )
            RETURNING tour_session_id, scheduled_start, status, group_size, tourguide_id, route_id, park_id`,
            [
                req.body.scheduled_start,
                req.body.group_size || null,
                req.body.vehicle_used || null,
                req.body.special_requests || null,
                guideProfile.rows[0].tourguide_id,
                req.body.route_id,
                parkId
            ]
        );
        return res.status(201).json({ success: true, assignment: ins.rows[0] });
    } catch (error) {
        console.error('create assignment', error);
        return res.status(500).json({ error: 'Failed to create assignment' });
    }
});

// =====================================================
// POST /api/tours/assignments/weekly (IT manager)
// Bulk weekly assignment for one guide
// =====================================================
router.post('/assignments/weekly', authenticateJWT, authorize('it_manager'), [
    body('guide_user_id').isUUID(),
    body('route_id').isUUID(),
    body('week_start').isISO8601(),
    body('days').isArray({ min: 1, max: 7 }),
    body('start_time').matches(/^\d{2}:\d{2}$/),
    body('group_size').optional().isInt({ min: 1, max: 200 }),
    body('vehicle_used').optional().isString(),
    body('special_requests').optional().isString(),
    body('park_id').optional().isUUID()
], async (req, res) => {
    try {
        if (!(await hasTourSchedulingTables())) {
            return res.status(503).json({ error: 'Tour scheduling is unavailable until database migrations are applied' });
        }
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const guideProfile = await pool.query(
            `SELECT tourguide_id FROM tour_guides
             WHERE user_id = $1 AND is_active = true`,
            [req.body.guide_user_id]
        );
        if (!guideProfile.rows.length) return res.status(404).json({ error: 'Guide not found or inactive' });

        const routeExists = await pool.query(`SELECT route_id FROM tour_routes WHERE route_id = $1`, [req.body.route_id]);
        if (!routeExists.rows.length) return res.status(404).json({ error: 'Route not found' });

        const parkId = req.body.park_id || (await defaultParkId());
        if (!parkId) return res.status(400).json({ error: 'No park available. Provide park_id or seed parks.' });

        const days = req.body.days
            .map((d) => Number(d))
            .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
        if (!days.length) return res.status(400).json({ error: 'days must contain weekday numbers 0-6' });

        const weekStart = new Date(req.body.week_start);
        if (Number.isNaN(weekStart.getTime())) return res.status(400).json({ error: 'Invalid week_start' });
        weekStart.setHours(0, 0, 0, 0);
        const [hours, minutes] = req.body.start_time.split(':').map((v) => Number(v));

        const created = [];
        for (const day of days) {
            const dt = new Date(weekStart);
            dt.setDate(weekStart.getDate() + day);
            dt.setHours(hours, minutes, 0, 0);
            const ins = await pool.query(
                `INSERT INTO tour_sessions (
                    scheduled_start, status, group_size, vehicle_used, special_requests,
                    tourguide_id, route_id, park_id
                ) VALUES (
                    $1, 'scheduled', $2, $3, $4, $5, $6, $7
                )
                RETURNING tour_session_id, scheduled_start, status, group_size`,
                [
                    dt.toISOString(),
                    req.body.group_size || null,
                    req.body.vehicle_used || null,
                    req.body.special_requests || null,
                    guideProfile.rows[0].tourguide_id,
                    req.body.route_id,
                    parkId
                ]
            );
            created.push(ins.rows[0]);
        }

        return res.status(201).json({ success: true, created_count: created.length, assignments: created });
    } catch (error) {
        console.error('weekly assignments', error);
        return res.status(500).json({ error: 'Failed to create weekly assignments' });
    }
});

// =====================================================
// GET /api/tours/assignments (IT manager)
// List assigned tour sessions with guide/route details
// =====================================================
router.get('/assignments', authenticateJWT, authorize('it_manager'), [
    query('start').optional().isISO8601(),
    query('end').optional().isISO8601(),
    query('guide_user_id').optional().isUUID(),
    query('status').optional().isIn(['scheduled', 'ongoing', 'completed', 'cancelled'])
], async (req, res) => {
    try {
        if (!(await hasTourSchedulingTables())) {
            return res.json({ assignments: [] });
        }
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const start = req.query.start || new Date(Date.now() - 7 * 86400000).toISOString();
        const end = req.query.end || new Date(Date.now() + 28 * 86400000).toISOString();
        const status = req.query.status || null;
        const guideUserId = req.query.guide_user_id || null;
        const params = [start, end];
        let p = 3;
        let extraWhere = '';

        if (status) {
            extraWhere += ` AND ts.status = $${p++}`;
            params.push(status);
        }
        if (guideUserId) {
            extraWhere += ` AND tg.user_id = $${p++}`;
            params.push(guideUserId);
        }

        const rows = await pool.query(
            `SELECT ts.tour_session_id, ts.scheduled_start, ts.actual_start, ts.actual_end, ts.status,
                    ts.group_size, ts.special_requests, ts.vehicle_used, ts.created_at,
                    tr.route_id, tr.name AS route_name, tr.distance_km, tr.difficulty,
                    tg.tourguide_id, tg.user_id AS guide_user_id,
                    u.username AS guide_username, u.first_name AS guide_first_name, u.last_name AS guide_last_name,
                    COUNT(tp.tourist_id)::int AS confirmed_guests
             FROM tour_sessions ts
             JOIN tour_routes tr ON tr.route_id = ts.route_id
             JOIN tour_guides tg ON tg.tourguide_id = ts.tourguide_id
             JOIN users u ON u.user_id = tg.user_id
             LEFT JOIN tour_participants tp ON tp.tour_session_id = ts.tour_session_id
             WHERE ts.scheduled_start BETWEEN $1 AND $2
               ${extraWhere}
             GROUP BY ts.tour_session_id, tr.route_id, tr.name, tr.distance_km, tr.difficulty,
                      tg.tourguide_id, tg.user_id, u.username, u.first_name, u.last_name
             ORDER BY ts.scheduled_start ASC`,
            params
        );
        return res.json({ assignments: rows.rows });
    } catch (error) {
        console.error('list assignments', error);
        return res.status(500).json({ error: 'Failed to list tour assignments' });
    }
});

// =====================================================
// GET /api/tours/schedule-view (Guide only)
// Daily/weekly/monthly assignment views
// =====================================================
router.get('/schedule-view', authenticateJWT, authorize('guide'), [
    query('mode').optional().isIn(['daily', 'weekly', 'monthly']),
    query('anchor').optional().isISO8601()
], async (req, res) => {
    const guideId = await resolveGuideProfileId(req.user.user_id);
    const mode = req.query.mode || 'daily';
    const anchor = req.query.anchor ? new Date(req.query.anchor) : new Date();
    const anchorIso = new Date(anchor).toISOString();
    try {
        if (!(await hasTourSchedulingTables())) return res.json({ mode, anchor: anchorIso, tours: [] });
        if (!guideId) return res.status(404).json({ error: 'Guide profile not found' });

        const start = new Date(anchor);
        const end = new Date(anchor);
        if (mode === 'daily') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (mode === 'weekly') {
            const day = start.getDay();
            const diffToMonday = (day + 6) % 7;
            start.setDate(start.getDate() - diffToMonday);
            start.setHours(0, 0, 0, 0);
            end.setTime(start.getTime());
            end.setDate(start.getDate() + 7);
        } else {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end.setMonth(start.getMonth() + 1, 1);
        }

        const rows = await pool.query(
            `SELECT ts.tour_session_id, ts.scheduled_start, ts.status, ts.group_size, ts.special_requests,
                    tr.name AS route_name, tr.difficulty, tr.distance_km,
                    COUNT(tp.tourist_id)::int AS confirmed_guests
             FROM tour_sessions ts
             JOIN tour_routes tr ON tr.route_id = ts.route_id
             LEFT JOIN tour_participants tp ON tp.tour_session_id = ts.tour_session_id
             WHERE ts.tourguide_id = $1
               AND ts.scheduled_start >= $2
               AND ts.scheduled_start < $3
             GROUP BY ts.tour_session_id, tr.name, tr.difficulty, tr.distance_km
             ORDER BY ts.scheduled_start ASC`,
            [guideId, start.toISOString(), end.toISOString()]
        );
        return res.json({ mode, anchor: anchorIso, range_start: start.toISOString(), range_end: end.toISOString(), tours: rows.rows });
    } catch (error) {
        console.error('schedule-view', error);
        return res.status(500).json({ error: 'Failed to fetch schedule view' });
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
// GET /api/tours/:id/preparation (Guide only)
// Route, guests, checklist, notes before tour
// =====================================================
router.get('/:id/preparation', authenticateJWT, authorize('guide'), async (req, res) => {
    try {
        if (!(await hasTourSchedulingTables())) {
            return res.status(503).json({ error: 'Tour scheduling is unavailable until database migrations are applied' });
        }
        const resolved = await getTourForGuideOrThrow(req.params.id, req.user.user_id);
        if (resolved.error) return res.status(resolved.error.status).json(resolved.error.payload);
        const { tour } = resolved;

        const [guests, waypoints] = await Promise.all([
            pool.query(
                `SELECT t.tourist_id, u.user_id, u.first_name, u.last_name, u.username, u.email,
                        t.nationality, t.interests, t.emergency_contact_name, t.emergency_contact_phone,
                        tp.pickup_location, tp.review, tp.rating
                 FROM tour_participants tp
                 JOIN tourists t ON t.tourist_id = tp.tourist_id
                 JOIN users u ON u.user_id = t.user_id
                 WHERE tp.tour_session_id = $1
                 ORDER BY u.first_name NULLS LAST, u.last_name NULLS LAST, u.username`,
                [req.params.id]
            ),
            pool.query(
                `SELECT rl.stop_order, rl.stop_duration, rl.estimated_time_from_prev,
                        l.name, l.location_type, l.description,
                        ST_Y(l.coordinates) AS latitude, ST_X(l.coordinates) AS longitude
                 FROM route_locations rl
                 JOIN locations l ON l.location_id = rl.location_id
                 WHERE rl.route_id = $1
                 ORDER BY rl.stop_order`,
                [tour.route_id]
            )
        ]);

        const guestRows = guests.rows;
        const specialRequirements = [];
        guestRows.forEach((g) => {
            if (g.pickup_location) specialRequirements.push(`Pickup: ${g.pickup_location}`);
        });
        if (tour.special_requests) specialRequirements.push(String(tour.special_requests));

        const checklist = [
            { key: 'route_review', label: 'Route reviewed', done: waypoints.rows.length > 0 },
            { key: 'guest_profiles', label: 'Guest profiles reviewed', done: guestRows.length > 0 },
            { key: 'safety_brief', label: 'Safety briefing prepared', done: true },
            { key: 'equipment', label: 'Equipment and comms check', done: true },
            { key: 'special_requirements', label: 'Special requirements reviewed', done: specialRequirements.length > 0 }
        ];

        return res.json({
            tour_session_id: req.params.id,
            route: {
                name: tour.route_name,
                difficulty: tour.difficulty,
                distance_km: tour.distance_km,
                duration_hours: tour.duration_hours,
                waypoints: waypoints.rows
            },
            guest_count: guestRows.length,
            guests: guestRows,
            special_requirements: specialRequirements,
            checklist,
            notes: tour.guide_notes || ''
        });
    } catch (error) {
        console.error('tour preparation', error);
        return res.status(500).json({ error: 'Failed to load tour preparation details' });
    }
});

// =====================================================
// GET /api/tours/:id/guest-list (Guide only)
// =====================================================
router.get('/:id/guest-list', authenticateJWT, authorize('guide'), async (req, res) => {
    try {
        if (!(await hasTourSchedulingTables())) {
            return res.status(503).json({ error: 'Tour scheduling is unavailable until database migrations are applied' });
        }
        const resolved = await getTourForGuideOrThrow(req.params.id, req.user.user_id);
        if (resolved.error) return res.status(resolved.error.status).json(resolved.error.payload);

        const guests = await pool.query(
            `SELECT t.tourist_id, u.user_id, u.first_name, u.last_name, u.username, u.email, u.phone,
                    t.nationality, t.interests, t.medical_notes, t.medical_notes_updated_at,
                    t.emergency_contact_name, t.emergency_contact_phone,
                    tp.pickup_location, tp.joined_at
             FROM tour_participants tp
             JOIN tourists t ON t.tourist_id = tp.tourist_id
             JOIN users u ON u.user_id = t.user_id
             WHERE tp.tour_session_id = $1
             ORDER BY u.first_name NULLS LAST, u.last_name NULLS LAST, u.username`,
            [req.params.id]
        );
        const redacted = await Promise.all(
            guests.rows.map((row) => redactMedicalNotes(row, req.user))
        );
        return res.json({ tour_session_id: req.params.id, guests: redacted });
    } catch (error) {
        console.error('guest list', error);
        return res.status(500).json({ error: 'Failed to load guest list' });
    }
});

// =====================================================
// GET /api/tours/guests/:id/profile (Guide only)
// =====================================================
router.get('/guests/:id/profile', authenticateJWT, authorize('guide'), async (req, res) => {
    try {
        const guideId = await resolveGuideProfileId(req.user.user_id);
        if (!guideId) return res.status(404).json({ error: 'Guide profile not found' });
        const touristId = req.params.id;

        const access = await pool.query(
            `SELECT 1
             FROM tour_sessions ts
             JOIN tour_participants tp ON tp.tour_session_id = ts.tour_session_id
             WHERE ts.tourguide_id = $1 AND tp.tourist_id = $2
             LIMIT 1`,
            [guideId, touristId]
        );
        if (!access.rows.length) {
            return res.status(403).json({ error: 'Guest is not assigned to your tours' });
        }

        const profile = await pool.query(
            `SELECT t.tourist_id, u.user_id, u.first_name, u.last_name, u.username, u.email, u.phone,
                    t.nationality, t.interests, t.total_visits, t.medical_notes, t.medical_notes_updated_at,
                    t.emergency_contact_name, t.emergency_contact_phone
             FROM tourists t
             JOIN users u ON u.user_id = t.user_id
             WHERE t.tourist_id = $1`,
            [touristId]
        );
        if (!profile.rows.length) return res.status(404).json({ error: 'Guest profile not found' });

        const history = await pool.query(
            `SELECT ts.tour_session_id, ts.scheduled_start, ts.status, tr.name AS route_name,
                    tp.rating, tp.review, tp.feedback_date
             FROM tour_participants tp
             JOIN tour_sessions ts ON ts.tour_session_id = tp.tour_session_id
             JOIN tour_routes tr ON tr.route_id = ts.route_id
             WHERE tp.tourist_id = $1
             ORDER BY ts.scheduled_start DESC
             LIMIT 20`,
            [touristId]
        );

        const safeProfile = await redactMedicalNotes(profile.rows[0], req.user);
        return res.json({ profile: safeProfile, history: history.rows });
    } catch (error) {
        console.error('guest profile', error);
        return res.status(500).json({ error: 'Failed to load guest profile' });
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
// GET /api/tours/:id/active-mode (Guide only)
// Live tour map + guest tracking + timer
// =====================================================
router.get('/:id/active-mode', authenticateJWT, authorize('guide'), async (req, res) => {
    try {
        const resolved = await getTourForGuideOrThrow(req.params.id, req.user.user_id);
        if (resolved.error) return res.status(resolved.error.status).json(resolved.error.payload);
        const { tour } = resolved;

        const guestPositions = await pool.query(
            `SELECT t.tourist_id, u.first_name, u.last_name, u.username,
                    u.last_lat, u.last_lng, u.last_location_time
             FROM tour_participants tp
             JOIN tourists t ON t.tourist_id = tp.tourist_id
             JOIN users u ON u.user_id = t.user_id
             WHERE tp.tour_session_id = $1
             ORDER BY u.first_name NULLS LAST, u.last_name NULLS LAST, u.username`,
            [req.params.id]
        );

        const scheduledMinutes = Number(tour.duration_hours || 0) * 60;
        const elapsedMinutes = tour.actual_start
            ? Math.max(0, Math.round((Date.now() - new Date(tour.actual_start).getTime()) / 60000))
            : 0;
        const remainingMinutes = scheduledMinutes > 0 ? Math.max(0, scheduledMinutes - elapsedMinutes) : null;

        return res.json({
            tour_session_id: req.params.id,
            status: tour.status,
            live_map: {
                guide_position: (tour.current_lat != null && tour.current_lng != null)
                    ? { lat: Number(tour.current_lat), lng: Number(tour.current_lng), updated_at: tour.last_location_update }
                    : null,
                guests: guestPositions.rows.map((g) => ({
                    tourist_id: g.tourist_id,
                    name: `${g.first_name || ''} ${g.last_name || ''}`.trim() || g.username,
                    position: (g.last_lat != null && g.last_lng != null) ? { lat: Number(g.last_lat), lng: Number(g.last_lng) } : null,
                    last_seen: g.last_location_time
                }))
            },
            timer: {
                actual_start: tour.actual_start,
                scheduled_duration_minutes: scheduledMinutes || null,
                elapsed_minutes: elapsedMinutes,
                remaining_minutes: remainingMinutes
            }
        });
    } catch (error) {
        console.error('active mode', error);
        return res.status(500).json({ error: 'Failed to load active tour mode' });
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

// =====================================================
// Shift management (Guide only)
// =====================================================
router.get('/guide/shifts/status', authenticateJWT, authorize('guide'), async (req, res) => {
    try {
        const guideId = await resolveGuideProfileId(req.user.user_id);
        if (!guideId) return res.status(404).json({ error: 'Guide profile not found' });
        const today = new Date().toISOString().slice(0, 10);
        const row = await pool.query(
            `SELECT shift_id, shift_date, start_time, end_time, actual_start, actual_end, status, notes
             FROM guide_shifts
             WHERE tourguide_id = $1 AND shift_date = $2
             ORDER BY actual_start DESC NULLS LAST, start_time ASC NULLS LAST
             LIMIT 1`,
            [guideId, today]
        );
        return res.json({ shift: row.rows[0] || null });
    } catch (error) {
        console.error('shift status', error);
        return res.status(500).json({ error: 'Failed to load shift status' });
    }
});

router.post('/guide/shifts/clock-in', authenticateJWT, authorize('guide'), async (req, res) => {
    try {
        const guideId = await resolveGuideProfileId(req.user.user_id);
        if (!guideId) return res.status(404).json({ error: 'Guide profile not found' });
        const today = new Date().toISOString().slice(0, 10);
        const existing = await pool.query(
            `SELECT shift_id, status
             FROM guide_shifts
             WHERE tourguide_id = $1 AND shift_date = $2
             ORDER BY actual_start DESC NULLS LAST
             LIMIT 1`,
            [guideId, today]
        );
        if (existing.rows[0]?.status === 'active') {
            return res.status(400).json({ error: 'Already clocked in for today' });
        }
        const upsert = await pool.query(
            `INSERT INTO guide_shifts (tourguide_id, shift_date, start_time, actual_start, status)
             VALUES ($1, $2, CURRENT_TIME, CURRENT_TIMESTAMP, 'active')
             ON CONFLICT (tourguide_id, shift_date, start_time)
             DO UPDATE SET actual_start = COALESCE(guide_shifts.actual_start, CURRENT_TIMESTAMP), status = 'active'
             RETURNING shift_id, shift_date, actual_start, status`,
            [guideId, today]
        );
        return res.json({ success: true, shift: upsert.rows[0] });
    } catch (error) {
        console.error('clock-in', error);
        return res.status(500).json({ error: 'Failed to clock in' });
    }
});

router.post('/guide/shifts/clock-out', authenticateJWT, authorize('guide'), async (req, res) => {
    try {
        const guideId = await resolveGuideProfileId(req.user.user_id);
        if (!guideId) return res.status(404).json({ error: 'Guide profile not found' });
        const today = new Date().toISOString().slice(0, 10);
        const row = await pool.query(
            `UPDATE guide_shifts
             SET actual_end = CURRENT_TIMESTAMP,
                 end_time = COALESCE(end_time, CURRENT_TIME),
                 status = 'completed'
             WHERE shift_id = (
                 SELECT shift_id FROM guide_shifts
                 WHERE tourguide_id = $1 AND shift_date = $2 AND status = 'active'
                 ORDER BY actual_start DESC NULLS LAST LIMIT 1
             )
             RETURNING shift_id, shift_date, actual_start, actual_end, status`,
            [guideId, today]
        );
        if (!row.rows.length) return res.status(400).json({ error: 'No active shift to clock out' });
        const shift = row.rows[0];
        const workedHours = shift.actual_start && shift.actual_end
            ? Number(((new Date(shift.actual_end) - new Date(shift.actual_start)) / 3600000).toFixed(2))
            : 0;
        return res.json({ success: true, shift, worked_hours: workedHours });
    } catch (error) {
        console.error('clock-out', error);
        return res.status(500).json({ error: 'Failed to clock out' });
    }
});

// =====================================================
// Guide profile/performance/emergency cards (Guide only)
// =====================================================
router.get('/guide/profile', authenticateJWT, authorize('guide'), async (req, res) => {
    try {
        const profile = await pool.query(
            `SELECT tg.tourguide_id, tg.license_number, tg.specialization, tg.years_of_experience,
                    tg.languages, tg.certification_level, tg.certification_date, tg.expiry_date,
                    tg.employee_id, tg.max_tour_duration, tg.total_tours_conducted, tg.average_rating,
                    tg.emergency_contact_name, tg.emergency_contact_phone,
                    u.user_id, u.username, u.first_name, u.last_name, u.email, u.phone
             FROM tour_guides tg
             JOIN users u ON u.user_id = tg.user_id
             WHERE tg.user_id = $1
             LIMIT 1`,
            [req.user.user_id]
        );
        if (!profile.rows.length) return res.status(404).json({ error: 'Guide profile not found' });
        return res.json({ profile: profile.rows[0] });
    } catch (error) {
        console.error('guide profile', error);
        return res.status(500).json({ error: 'Failed to load guide profile' });
    }
});

router.get('/guide/performance', authenticateJWT, authorize('guide'), [
    query('start').optional().isISO8601(),
    query('end').optional().isISO8601()
], async (req, res) => {
    try {
        const guideId = await resolveGuideProfileId(req.user.user_id);
        if (!guideId) return res.status(404).json({ error: 'Guide profile not found' });
        const start = req.query.start || new Date(Date.now() - 90 * 86400000).toISOString();
        const end = req.query.end || new Date().toISOString();
        const stats = await pool.query(
            `SELECT COUNT(*)::int AS tour_count,
                    COALESCE(SUM(COALESCE(ts.group_size, 0)), 0)::int AS guest_count,
                    ROUND(AVG(tp.rating)::numeric, 2) AS average_rating
             FROM tour_sessions ts
             LEFT JOIN tour_participants tp ON tp.tour_session_id = ts.tour_session_id
             WHERE ts.tourguide_id = $1
               AND ts.scheduled_start BETWEEN $2 AND $3`,
            [guideId, start, end]
        );
        const row = stats.rows[0] || {};
        const achievements = [];
        if (Number(row.tour_count || 0) >= 10) achievements.push('10+ tours delivered');
        if (Number(row.guest_count || 0) >= 50) achievements.push('Served 50+ guests');
        if (Number(row.average_rating || 0) >= 4.5) achievements.push('High guest rating');
        return res.json({
            range: { start, end },
            tour_count: Number(row.tour_count || 0),
            guest_count: Number(row.guest_count || 0),
            average_rating: Number(row.average_rating || 0),
            achievements
        });
    } catch (error) {
        console.error('guide performance', error);
        return res.status(500).json({ error: 'Failed to load guide performance' });
    }
});

router.get('/guide/emergency-contacts', authenticateJWT, authorize('guide'), async (req, res) => {
    try {
        const contacts = await pool.query(
            `SELECT p.name AS park_name, p.emergency_phone,
                    'Park emergency line'::text AS contact_type
             FROM parks p
             ORDER BY p.name`
        );
        const fallbacks = [
            { contact_type: 'Ranger desk', name: 'Bwindi Ranger Desk', phone: '+256-000-000-001' },
            { contact_type: 'Medical', name: 'Bwindi Field Clinic', phone: '+256-000-000-002' }
        ];
        return res.json({
            contacts: [
                ...contacts.rows.map((c) => ({ contact_type: c.contact_type, name: c.park_name, phone: c.emergency_phone })),
                ...fallbacks
            ]
        });
    } catch (error) {
        console.error('emergency contacts', error);
        return res.status(500).json({ error: 'Failed to load emergency contacts' });
    }
});

// =====================================================
// GET /api/tours/:id/completion-report (Guide only)
// =====================================================
router.get('/:id/completion-report', authenticateJWT, authorize('guide'), async (req, res) => {
    try {
        const resolved = await getTourForGuideOrThrow(req.params.id, req.user.user_id);
        if (resolved.error) return res.status(resolved.error.status).json(resolved.error.payload);
        const { tour } = resolved;
        const [sightings, feedback] = await Promise.all([
            pool.query(
                `SELECT COUNT(*)::int AS total_sightings,
                        COUNT(DISTINCT animal_id)::int AS unique_species
                 FROM sightings
                 WHERE toursession_id = $1`,
                [req.params.id]
            ),
            pool.query(
                `SELECT COUNT(tp.rating)::int AS rated_guests,
                        ROUND(AVG(tp.rating)::numeric, 2) AS average_guest_rating
                 FROM tour_participants tp
                 WHERE tp.tour_session_id = $1`,
                [req.params.id]
            )
        ]);
        const duration = (tour.actual_start && tour.actual_end)
            ? Math.round((new Date(tour.actual_end) - new Date(tour.actual_start)) / 60000)
            : null;
        return res.json({
            tour_session_id: req.params.id,
            route_name: tour.route_name,
            duration_minutes: duration,
            distance_km: tour.distance_km,
            sightings: sightings.rows[0],
            feedback_summary: feedback.rows[0]
        });
    } catch (error) {
        console.error('completion report', error);
        return res.status(500).json({ error: 'Failed to build completion report' });
    }
});

module.exports = router;
