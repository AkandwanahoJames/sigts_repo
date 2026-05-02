/**
 * Guide-to-guide messaging (§3.1.1.5).
 */
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateJWT, authorize } = require('../middleware/auth');

router.use(authenticateJWT);
router.use(authorize('guide', 'it_manager'));

async function tableExists() {
    const r = await pool.query(`
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'guide_messages'
    `);
    return r.rows.length > 0;
}

router.get(
    '/',
    [
        query('box').optional().isIn(['inbox', 'sent']),
        query('limit').optional().isInt({ min: 1, max: 100 })
    ],
    async (req, res) => {
        if (!(await tableExists())) {
            return res.status(503).json({ error: 'guide_messages missing; apply migration 011_capability_extensions.sql' });
        }
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        const uid = req.user.user_id;
        const box = req.query.box || 'inbox';
        const limit = Number(req.query.limit || 40);

        try {
            const cols =
                box === 'sent'
                    ? `m.message_id, m.to_user_id AS peer_id,
                       u.username AS peer_username, m.body, m.created_at, m.read_at`
                    : `m.message_id, m.from_user_id AS peer_id,
                       u.username AS peer_username, m.body, m.created_at, m.read_at`;

            const sql =
                box === 'sent'
                    ? `SELECT ${cols}
                       FROM guide_messages m
                       JOIN users u ON u.user_id = m.to_user_id
                       WHERE m.from_user_id = $1
                       ORDER BY m.created_at DESC
                       LIMIT $2`
                    : `SELECT ${cols}
                       FROM guide_messages m
                       JOIN users u ON u.user_id = m.from_user_id
                       WHERE m.to_user_id = $1
                       ORDER BY m.created_at DESC
                       LIMIT $2`;

            const r = await pool.query(sql, [uid, limit]);
            return res.json({ messages: r.rows });
        } catch (e) {
            console.error('guide messages list', e);
            return res.status(500).json({ error: 'Failed to load messages' });
        }
    }
);

router.post(
    '/',
    [
        body('to_user_id').isUUID(),
        body('body').isString().isLength({ min: 1, max: 4000 })
    ],
    async (req, res) => {
        if (!(await tableExists())) {
            return res.status(503).json({ error: 'guide_messages missing; apply migration 011' });
        }
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { to_user_id, body: text } = req.body;
        if (to_user_id === req.user.user_id) {
            return res.status(400).json({ error: 'Cannot message yourself' });
        }

        try {
            const [me, peer] = await Promise.all([
                pool.query(`SELECT user_type FROM users WHERE user_id = $1 AND is_active = true`, [req.user.user_id]),
                pool.query(`SELECT user_type FROM users WHERE user_id = $1 AND is_active = true`, [to_user_id])
            ]);
            const myRole = me.rows[0]?.user_type;
            const peerRole = peer.rows[0]?.user_type;
            if (!['guide', 'it_manager'].includes(myRole)) {
                return res.status(403).json({ error: 'Only guides and IT managers use this channel' });
            }
            if (!['guide', 'it_manager'].includes(peerRole)) {
                return res.status(400).json({ error: 'Recipient must be a guide or IT manager' });
            }

            const ins = await pool.query(
                `INSERT INTO guide_messages (from_user_id, to_user_id, body)
                 VALUES ($1, $2, $3)
                 RETURNING message_id, created_at`,
                [req.user.user_id, to_user_id, String(text).trim()]
            );

            return res.status(201).json({ success: true, message: ins.rows[0] });
        } catch (e) {
            console.error('guide message send', e);
            return res.status(500).json({ error: 'Failed to send message' });
        }
    }
);

router.patch('/:id/read', async (req, res) => {
        if (!(await tableExists())) {
            return res.status(503).json({ error: 'guide_messages missing' });
        }
        try {
            const r = await pool.query(
                `UPDATE guide_messages
                 SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
                 WHERE message_id = $1 AND to_user_id = $2
                 RETURNING message_id`,
                [req.params.id, req.user.user_id]
            );
            if (!r.rows.length) return res.status(404).json({ error: 'Message not found' });
            return res.json({ success: true });
        } catch (e) {
            console.error('guide message read', e);
            return res.status(500).json({ error: 'Failed to mark read' });
        }
    }
);

router.get('/peers', async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT u.user_id, u.username,
                    COALESCE(TRIM(CONCAT(u.first_name, ' ', u.last_name)), u.username) AS display_name,
                    u.user_type
             FROM users u
             WHERE u.is_active = true
               AND u.user_type IN ('guide', 'it_manager')
               AND u.user_id <> $1
             ORDER BY u.username ASC
             LIMIT 200`,
            [req.user.user_id]
        );
        return res.json({ peers: r.rows });
    } catch (e) {
        console.error('guide peers list', e);
        return res.status(500).json({ error: 'Failed to load peers' });
    }
});

module.exports = router;
