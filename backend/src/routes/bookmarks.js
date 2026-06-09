const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateJWT, rejectGuestAccounts } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateJWT, rejectGuestAccounts);

const CONTENT_TYPES = ['animal', 'location', 'cultural', 'tab'];

// GET /api/users/bookmarks
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT content_type AS type, content_id AS id, title, saved_at AS "savedAt"
             FROM user_bookmarks
             WHERE user_id = $1
             ORDER BY saved_at DESC`,
            [req.user.user_id]
        );
        res.json({ success: true, bookmarks: result.rows });
    } catch (err) {
        if (err.code === '42P01') {
            return res.json({ success: true, bookmarks: [], migration_required: true });
        }
        console.error('GET bookmarks', err);
        res.status(500).json({ error: 'Failed to load bookmarks' });
    }
});

// PUT /api/users/bookmarks/sync — replace all bookmarks for user
router.put(
    '/sync',
    [body('bookmarks').isArray({ max: 500 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const userId = req.user.user_id;
        const incoming = (req.body.bookmarks || []).filter(
            (b) => b && CONTENT_TYPES.includes(String(b.type)) && String(b.id || '').trim()
        );

        try {
            await pool.query('BEGIN');
            await pool.query('DELETE FROM user_bookmarks WHERE user_id = $1', [userId]);
            for (const b of incoming.slice(0, 500)) {
                await pool.query(
                    `INSERT INTO user_bookmarks (user_id, content_type, content_id, title, saved_at)
                     VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, CURRENT_TIMESTAMP))
                     ON CONFLICT (user_id, content_type, content_id) DO UPDATE SET title = EXCLUDED.title`,
                    [
                        userId,
                        String(b.type),
                        String(b.id).slice(0, 120),
                        String(b.title || b.id).slice(0, 320),
                        b.savedAt || null
                    ]
                );
            }
            await pool.query('COMMIT');
            const result = await pool.query(
                `SELECT content_type AS type, content_id AS id, title, saved_at AS "savedAt"
                 FROM user_bookmarks WHERE user_id = $1 ORDER BY saved_at DESC`,
                [userId]
            );
            res.json({ success: true, bookmarks: result.rows });
        } catch (err) {
            await pool.query('ROLLBACK').catch(() => {});
            if (err.code === '42P01') {
                return res.status(503).json({ error: 'Bookmarks unavailable — run migration 016' });
            }
            console.error('PUT bookmarks sync', err);
            res.status(500).json({ error: 'Failed to sync bookmarks' });
        }
    }
);

// POST /api/users/bookmarks
router.post(
    '/',
    [
        body('type').isIn(CONTENT_TYPES),
        body('id').isString().trim().isLength({ min: 1, max: 120 }),
        body('title').optional().isString().isLength({ max: 320 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        try {
            const result = await pool.query(
                `INSERT INTO user_bookmarks (user_id, content_type, content_id, title)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (user_id, content_type, content_id)
                 DO UPDATE SET title = EXCLUDED.title, saved_at = CURRENT_TIMESTAMP
                 RETURNING content_type AS type, content_id AS id, title, saved_at AS "savedAt"`,
                [req.user.user_id, req.body.type, req.body.id, req.body.title || req.body.id]
            );
            res.status(201).json({ success: true, bookmark: result.rows[0] });
        } catch (err) {
            if (err.code === '42P01') {
                return res.status(503).json({ error: 'Bookmarks unavailable — run migration 016' });
            }
            console.error('POST bookmark', err);
            res.status(500).json({ error: 'Failed to save bookmark' });
        }
    }
);

// DELETE /api/users/bookmarks/:type/:id
router.delete('/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    if (!CONTENT_TYPES.includes(type)) {
        return res.status(400).json({ error: 'Invalid content type' });
    }
    try {
        await pool.query(
            `DELETE FROM user_bookmarks WHERE user_id = $1 AND content_type = $2 AND content_id = $3`,
            [req.user.user_id, type, id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE bookmark', err);
        res.status(500).json({ error: 'Failed to remove bookmark' });
    }
});

module.exports = router;
