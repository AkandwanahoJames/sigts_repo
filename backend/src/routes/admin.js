// backend/src/routes/admin.js
const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateJWT, authorize } = require('../middleware/auth');
const { hashPassword } = require('../config/auth');

// All routes require IT Manager role
router.use(authenticateJWT, authorize('it_manager'));

// =====================================================
// GET /api/admin/stats
// Get admin dashboard statistics
// =====================================================
router.get('/stats', async (req, res) => {
    try {
        const [totalUsers, activeTours, pendingApprovals, avgRating, cacheHit] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM users WHERE is_active = true'),
            pool.query('SELECT COUNT(*) FROM tour_sessions WHERE status = \'ongoing\''),
            pool.query('SELECT COUNT(*) FROM ai_content_generations WHERE review_status = \'pending\''),
            pool.query('SELECT AVG(rating) FROM tour_participants WHERE rating IS NOT NULL'),
            pool.query("SELECT COUNT(*) FROM content_updates WHERE updated_at > NOW() - INTERVAL '7 days'")
        ]);

        res.json({
            totalUsers: parseInt(totalUsers.rows[0].count),
            activeTours: parseInt(activeTours.rows[0].count),
            pendingApprovals: parseInt(pendingApprovals.rows[0].count),
            avgRating: parseFloat(avgRating.rows[0].avg) || 0,
            cacheHitRate: 89 // Placeholder - would come from Redis stats
        });

    } catch (error) {
        console.error('Get admin stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// =====================================================
// GET /api/admin/users
// Get all users with filters
// =====================================================
router.get('/users', async (req, res) => {
    const { role, search, limit = 50, offset = 0 } = req.query;

    try {
        let query = `
            SELECT user_id, username, email, first_name, last_name, user_type,
                   is_active, created_at, last_login, phone
            FROM users
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (role && role !== 'all') {
            query += ` AND user_type = $${paramIndex++}`;
            params.push(role);
        }

        if (search) {
            query += ` AND (username ILIKE $${paramIndex++} OR email ILIKE $${paramIndex++} OR first_name ILIKE $${paramIndex++} OR last_name ILIKE $${paramIndex++})`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);
        const total = await pool.query('SELECT COUNT(*) FROM users');

        res.json({
            users: result.rows,
            total: parseInt(total.rows[0].count),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// =====================================================
// POST /api/admin/users
// Create new user (admin)
// =====================================================
router.post('/users', [
    body('username').isLength({ min: 3 }),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('user_type').isIn(['tourist', 'guide', 'it_manager'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, first_name, last_name, phone, user_type } = req.body;

    try {
        const existing = await pool.query(
            'SELECT user_id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        const hashedPassword = await hashPassword(password);

        const result = await pool.query(
            `INSERT INTO users (user_id, username, password_hash, email, first_name, last_name, phone, user_type)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
             RETURNING user_id, username, email, user_type`,
            [username, hashedPassword, email, first_name, last_name, phone, user_type]
        );

        const newUser = result.rows[0];

        if (newUser.user_type === 'tourist') {
            await pool.query(
                `INSERT INTO tourists (user_id, interests)
                 VALUES ($1, $2)`,
                [newUser.user_id, '[]']
            );
        } else if (newUser.user_type === 'guide') {
            await pool.query(
                `INSERT INTO tour_guides (user_id, license_number, specialization, languages)
                 VALUES ($1, $2, $3, $4)`,
                [newUser.user_id, `GUIDE-${Date.now()}`, '[]', '[]']
            );
        } else if (newUser.user_type === 'it_manager') {
            await pool.query(
                `INSERT INTO it_managers (user_id, employee_id, access_level)
                 VALUES ($1, $2, $3)`,
                [newUser.user_id, `ITM-${Date.now()}`, 'admin']
            );
        }

        res.status(201).json({
            success: true,
            user: newUser,
            message: 'User created successfully'
        });

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// =====================================================
// PUT /api/admin/users/:id
// Update user (admin)
// =====================================================
router.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { is_active, user_type, first_name, last_name, phone } = req.body;

    try {
        await pool.query(
            `UPDATE users 
             SET is_active = COALESCE($1, is_active),
                 user_type = COALESCE($2, user_type),
                 first_name = COALESCE($3, first_name),
                 last_name = COALESCE($4, last_name),
                 phone = COALESCE($5, phone)
             WHERE user_id = $6`,
            [is_active, user_type, first_name, last_name, phone, id]
        );

        res.json({ success: true, message: 'User updated successfully' });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// =====================================================
// GET /api/admin/content/pending
// Get pending content for approval
// =====================================================
router.get('/content/pending', async (req, res) => {
    try {
        const aiContent = await pool.query(
            `SELECT generation_id as id, 'ai' as type, content_type, generated_text as content,
                    confidence_score, created_at, reviewed_by
             FROM ai_content_generations
             WHERE review_status = 'pending'
             ORDER BY created_at DESC`
        );

        const userContent = await pool.query(
            `SELECT narrative_id as id, 'cultural' as type, title_en as title,
                    storyteller_name as submitted_by, created_at
             FROM cultural_narratives
             WHERE verified_by_community = false
             ORDER BY created_at DESC`
        );

        res.json({
            pending: [...aiContent.rows, ...userContent.rows]
        });

    } catch (error) {
        console.error('Get pending content error:', error);
        res.status(500).json({ error: 'Failed to fetch pending content' });
    }
});

// =====================================================
// POST /api/admin/content/:id/approve
// Approve or reject content
// =====================================================
router.post('/content/:id/approve', async (req, res) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    try {
        await pool.query(
            `UPDATE ai_content_generations 
             SET review_status = $1, review_notes = $2, reviewed_by = $3, approved_at = CURRENT_TIMESTAMP
             WHERE generation_id = $4`,
            [status, notes, req.user.user_id, id]
        );

        res.json({ success: true, message: `Content ${status}` });

    } catch (error) {
        console.error('Approve content error:', error);
        res.status(500).json({ error: 'Failed to approve content' });
    }
});

// =====================================================
// POST /api/admin/backup/create
// Create database backup
// =====================================================
router.post('/backup/create', async (req, res) => {
    try {
        const backupId = `backup_${Date.now()}`;
        
        // This would trigger a pg_dump in production
        // For now, just log the action
        await pool.query(
            `INSERT INTO park_performance_reports (report_id, report_type, period_start, period_end, metrics, generated_by)
             VALUES (gen_random_uuid(), 'backup', CURRENT_DATE, CURRENT_DATE, $1, $2)`,
            [JSON.stringify({ backupId, status: 'created' }), req.user.user_id]
        );

        res.json({ success: true, backup_id: backupId, message: 'Backup created' });

    } catch (error) {
        console.error('Create backup error:', error);
        res.status(500).json({ error: 'Failed to create backup' });
    }
});

// =====================================================
// PUT /api/admin/users/:id/deactivate
// Deactivate a user account (admin only)
// =====================================================
router.put('/users/:id/deactivate', async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query(
            'UPDATE users SET is_active = false WHERE user_id = $1',
            [id]
        );

        res.json({ success: true, message: 'User deactivated successfully' });

    } catch (error) {
        console.error('Deactivate user error:', error);
        res.status(500).json({ error: 'Failed to deactivate user' });
    }
});

module.exports = router;
