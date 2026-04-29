const express = require('express');
const { body, validationResult, query } = require('express-validator');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateJWT, authorize } = require('../middleware/auth');

async function resolveTouristId(userId) {
    const result = await pool.query(
        'SELECT tourist_id FROM tourists WHERE user_id = $1 LIMIT 1',
        [userId]
    );
    return result.rows[0]?.tourist_id || null;
}

async function resolveGuideId(userId) {
    const result = await pool.query(
        'SELECT tourguide_id FROM tour_guides WHERE user_id = $1 LIMIT 1',
        [userId]
    );
    return result.rows[0]?.tourguide_id || null;
}

// POST /api/feedback
router.post(
    '/',
    authenticateJWT,
    [
        body('rating').isInt({ min: 1, max: 5 }),
        body('comment').optional().isString().isLength({ max: 2000 }),
        body('category').optional().isIn([
            'tour', 'guide', 'content', 'app', 'general',
            'bug_report', 'feature_suggestion', 'nps', 'survey', 'helpfulness'
        ]),
        body('tour_session_id').optional().isUUID(),
        body('tourguide_id').optional().isUUID(),
        body('source_content_id').optional().isUUID(),
        body('source_content_type').optional().isString().isLength({ min: 2, max: 40 }),
        body('nps_score').optional().isInt({ min: 0, max: 10 }),
        body('helpfulness_rating').optional().isInt({ min: 1, max: 5 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.user.user_id;
        const {
            rating,
            comment,
            category,
            tour_session_id,
            tourguide_id,
            source_content_id,
            source_content_type,
            nps_score,
            helpfulness_rating
        } = req.body;

        try {
            const touristId = await resolveTouristId(userId);
            const guideId = tourguide_id || await resolveGuideId(userId);

            const result = await pool.query(
                `INSERT INTO feedback (
                    feedback_id, rating, comment, category, tourist_id, tour_session_id, tourguide_id,
                    source_content_id, source_content_type, nps_score, helpfulness_rating
                )
                VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
                )
                RETURNING feedback_id, rating, comment, category, created_at, nps_score, helpfulness_rating`,
                [
                    rating,
                    comment || null,
                    category || 'general',
                    touristId,
                    tour_session_id || null,
                    guideId || null,
                    source_content_id || null,
                    source_content_type || null,
                    nps_score ?? null,
                    helpfulness_rating ?? null
                ]
            );

            return res.status(201).json({
                success: true,
                feedback: result.rows[0]
            });
        } catch (error) {
            console.error('Create feedback error:', error);
            return res.status(500).json({ error: 'Failed to submit feedback' });
        }
    }
);

// GET /api/feedback/mine
router.get(
    '/mine',
    authenticateJWT,
    [
        query('limit').optional().isInt({ min: 1, max: 100 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.user.user_id;
        const userType = req.user.user_type;
        const limit = Number(req.query.limit || 20);

        try {
            const touristId = await resolveTouristId(userId);
            const guideId = await resolveGuideId(userId);
            let rows = [];

            if (userType === 'it_manager') {
                const result = await pool.query(
                    `SELECT feedback_id, rating, comment, category, created_at, tour_session_id,
                            response_text, responded_at, nps_score, helpfulness_rating
                     FROM feedback
                     ORDER BY created_at DESC
                     LIMIT $1`,
                    [limit]
                );
                rows = result.rows;
            } else if (userType === 'guide') {
                const result = await pool.query(
                    `SELECT feedback_id, rating, comment, category, created_at, tour_session_id,
                            response_text, responded_at, nps_score, helpfulness_rating
                     FROM feedback
                     WHERE tourguide_id = $1
                     ORDER BY created_at DESC
                     LIMIT $2`,
                    [guideId, limit]
                );
                rows = result.rows;
            } else {
                const result = await pool.query(
                    `SELECT feedback_id, rating, comment, category, created_at, tour_session_id,
                            response_text, responded_at, nps_score, helpfulness_rating
                     FROM feedback
                     WHERE tourist_id = $1
                     ORDER BY created_at DESC
                     LIMIT $2`,
                    [touristId, limit]
                );
                rows = result.rows;
            }

            return res.json({ success: true, feedback: rows });
        } catch (error) {
            console.error('Get feedback error:', error);
            return res.status(500).json({ error: 'Failed to fetch feedback' });
        }
    }
);

// GET /api/feedback/dashboard (IT manager)
router.get(
    '/dashboard',
    authenticateJWT,
    authorize('it_manager'),
    [query('days').optional().isInt({ min: 1, max: 365 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const days = Number(req.query.days || 30);
        try {
            const summary = await pool.query(
                `SELECT
                    COUNT(*)::int AS total_feedback,
                    ROUND(AVG(rating)::numeric, 2) AS avg_rating,
                    COUNT(*) FILTER (WHERE category = 'bug_report')::int AS bug_reports,
                    COUNT(*) FILTER (WHERE category = 'feature_suggestion')::int AS feature_requests,
                    COUNT(*) FILTER (WHERE response_text IS NOT NULL)::int AS responded_count
                 FROM feedback
                 WHERE created_at > NOW() - ($1::text || ' days')::interval`,
                [days]
            );

            const recent = await pool.query(
                `SELECT feedback_id, rating, comment, category, created_at,
                        response_text, responded_at
                 FROM feedback
                 WHERE created_at > NOW() - ($1::text || ' days')::interval
                 ORDER BY created_at DESC
                 LIMIT 40`,
                [days]
            );

            return res.json({
                success: true,
                summary: summary.rows[0],
                recent: recent.rows
            });
        } catch (error) {
            console.error('Feedback dashboard error:', error);
            return res.status(500).json({ error: 'Failed to fetch feedback dashboard' });
        }
    }
);

// PUT /api/feedback/:id/respond (IT manager)
router.put(
    '/:id/respond',
    authenticateJWT,
    authorize('it_manager'),
    [body('response_text').isString().isLength({ min: 2, max: 2000 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        try {
            const result = await pool.query(
                `UPDATE feedback
                 SET response_text = $1,
                     responded_at = CURRENT_TIMESTAMP,
                     responded_by = $2
                 WHERE feedback_id = $3
                 RETURNING feedback_id, response_text, responded_at`,
                [req.body.response_text, req.user.user_id, req.params.id]
            );

            if (!result.rows.length) {
                return res.status(404).json({ error: 'Feedback not found' });
            }
            return res.json({ success: true, feedback: result.rows[0] });
        } catch (error) {
            console.error('Feedback response error:', error);
            return res.status(500).json({ error: 'Failed to respond to feedback' });
        }
    }
);

module.exports = router;
