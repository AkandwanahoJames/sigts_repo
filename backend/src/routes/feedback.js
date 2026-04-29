const express = require('express');
const { body, validationResult, query } = require('express-validator');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateJWT } = require('../middleware/auth');

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
        body('category').optional().isIn(['tour', 'guide', 'content', 'app', 'general']),
        body('tour_session_id').optional().isUUID(),
        body('tourguide_id').optional().isUUID()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.user.user_id;
        const { rating, comment, category, tour_session_id, tourguide_id } = req.body;

        try {
            const touristId = await resolveTouristId(userId);
            const guideId = tourguide_id || await resolveGuideId(userId);

            const result = await pool.query(
                `INSERT INTO feedback (
                    feedback_id, rating, comment, category, tourist_id, tour_session_id, tourguide_id
                )
                VALUES (
                    gen_random_uuid(), $1, $2, $3, $4, $5, $6
                )
                RETURNING feedback_id, rating, comment, category, created_at`,
                [rating, comment || null, category || 'general', touristId, tour_session_id || null, guideId || null]
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
                    `SELECT feedback_id, rating, comment, category, created_at, tour_session_id
                     FROM feedback
                     ORDER BY created_at DESC
                     LIMIT $1`,
                    [limit]
                );
                rows = result.rows;
            } else if (userType === 'guide') {
                const result = await pool.query(
                    `SELECT feedback_id, rating, comment, category, created_at, tour_session_id
                     FROM feedback
                     WHERE tourguide_id = $1
                     ORDER BY created_at DESC
                     LIMIT $2`,
                    [guideId, limit]
                );
                rows = result.rows;
            } else {
                const result = await pool.query(
                    `SELECT feedback_id, rating, comment, category, created_at, tour_session_id
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

module.exports = router;
