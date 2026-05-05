// backend/src/routes/admin.js
const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateJWT, authorize } = require('../middleware/auth');
const { hashPassword } = require('../config/auth');
const { audit } = require('../utils/audit');

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
// GET /api/admin/active-users
// Realtime logged-in users from auth heartbeat
// =====================================================
router.get('/active-users', [
    query('window_minutes').optional().isInt({ min: 1, max: 120 })
], async (req, res) => {
    try {
        const windowMinutes = Number.parseInt(req.query.window_minutes, 10) || 5;
        const tableCheck = await pool.query(
            `SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'users'
               AND column_name = 'last_location_time'
             LIMIT 1`
        );
        const hasHeartbeatColumn = tableCheck.rows.length > 0;
        const activeSinceInterval = `${windowMinutes} minutes`;

        const sql = hasHeartbeatColumn
            ? `SELECT user_id, username, user_type, email,
                      COALESCE(last_location_time, last_login) AS last_seen,
                      last_login, last_lat, last_lng
               FROM users
               WHERE is_active = true
                 AND COALESCE(last_location_time, last_login) IS NOT NULL
                 AND COALESCE(last_location_time, last_login) > NOW() - ($1)::interval
               ORDER BY COALESCE(last_location_time, last_login) DESC`
            : `SELECT user_id, username, user_type, email,
                      last_login AS last_seen,
                      last_login, last_lat, last_lng
               FROM users
               WHERE is_active = true
                 AND last_login IS NOT NULL
                 AND last_login > NOW() - ($1)::interval
               ORDER BY last_login DESC`;

        const rows = await pool.query(sql, [activeSinceInterval]);
        const activeUsers = rows.rows.map((row) => ({
            user_id: row.user_id,
            username: row.username,
            name: row.username,
            email: row.email,
            type: row.user_type,
            role: row.user_type,
            location: (row.last_lat != null && row.last_lng != null)
                ? { lat: Number(row.last_lat), lng: Number(row.last_lng) }
                : null,
            last_seen: row.last_seen,
            last_login: row.last_login
        }));

        return res.json({
            window_minutes: windowMinutes,
            count: activeUsers.length,
            users: activeUsers
        });
    } catch (error) {
        console.error('Get active users error:', error);
        return res.status(500).json({ error: 'Failed to fetch active users' });
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

        await audit(req, {
            action: 'user.create',
            table_name: 'users',
            record_id: newUser.user_id,
            new_value: newUser
        });

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
        const before = await pool.query(
            'SELECT user_id, is_active, user_type, first_name, last_name, phone FROM users WHERE user_id = $1',
            [id]
        );

        const updated = await pool.query(
            `UPDATE users
             SET is_active = COALESCE($1, is_active),
                 user_type = COALESCE($2, user_type),
                 first_name = COALESCE($3, first_name),
                 last_name = COALESCE($4, last_name),
                 phone = COALESCE($5, phone)
             WHERE user_id = $6
             RETURNING user_id, is_active, user_type, first_name, last_name, phone`,
            [is_active, user_type, first_name, last_name, phone, id]
        );

        await audit(req, {
            action: 'user.update',
            table_name: 'users',
            record_id: id,
            old_value: before.rows[0] || null,
            new_value: updated.rows[0] || null
        });

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

        await audit(req, {
            action: 'content.review',
            table_name: 'ai_content_generations',
            record_id: id,
            new_value: { status, notes }
        });

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

// GET /api/admin/backup/list — recent backup artefacts recorded in ops reports table
router.get('/backup/list', async (req, res) => {
    try {
        const r = await pool.query(
            `SELECT report_id, report_type, period_start, period_end, metrics, generated_at
             FROM park_performance_reports
             WHERE report_type IN ('backup', 'automated_backup')
             ORDER BY generated_at DESC NULLS LAST
             LIMIT 40`
        );
        res.json({
            backups: r.rows,
            ops_note:
                'Production: point this at pg_dump artefacts (S3/Share) and enforce retention separately.'
        });
    } catch (error) {
        console.error('Backup list error:', error);
        res.status(500).json({ error: 'Failed to list backups' });
    }
});

// POST /api/admin/animals/bulk-json — CSV-style rows as JSON array (§3.1.1.10 bulk upload)
router.post('/animals/bulk-json', [
    body('animals').isArray({ min: 1 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const rows = req.body.animals;
    let inserted = 0;
    let updated = 0;
    try {
        for (const raw of rows) {
            const name = String(raw.name || '').trim();
            const sci = String(raw.scientific_name || '').trim();
            if (!name || !sci) continue;
            const existing = await pool.query(
                `SELECT animal_id FROM animals WHERE LOWER(name) = LOWER($1) LIMIT 1`,
                [name]
            );
            if (existing.rows[0]?.animal_id) {
                await pool.query(
                    `UPDATE animals SET
                        scientific_name = COALESCE(NULLIF($2::text,''), scientific_name),
                        description = COALESCE($3::text, description),
                        conservation_status = COALESCE($4::text, conservation_status),
                        habitat = COALESCE($5::text, habitat),
                        updated_at = CURRENT_TIMESTAMP
                     WHERE animal_id = $1`,
                    [
                        existing.rows[0].animal_id,
                        sci,
                        raw.description || null,
                        raw.conservation_status || null,
                        raw.habitat || null
                    ]
                );
                updated += 1;
            } else {
                await pool.query(
                    `INSERT INTO animals (
                        name, scientific_name, description, conservation_status,
                        habitat, image_urls
                    ) VALUES ($1,$2,$3,$4,$5, COALESCE($6::text[], ARRAY[]::text[]))`,
                    [
                        name,
                        sci,
                        raw.description || '',
                        raw.conservation_status || 'least_concern',
                        raw.habitat || 'Montane forest',
                        Array.isArray(raw.image_urls) ? raw.image_urls : null
                    ]
                );
                inserted += 1;
            }
        }
        await audit(req, {
            action: 'animals.bulk_import',
            table_name: 'animals',
            record_id: null,
            new_value: { inserted, updated, attempted: rows.length }
        });
        res.json({ success: true, inserted, updated, attempted: rows.length });
    } catch (error) {
        console.error('Bulk animals import:', error);
        res.status(500).json({ error: 'Bulk import failed' });
    }
});

async function alertRulesReady() {
    const r = await pool.query(`
        SELECT 1 FROM information_schema.tables
        WHERE table_schema='public' AND table_name='system_alert_rules'
    `);
    return r.rows.length > 0;
}

router.get('/alert-rules', async (req, res) => {
    try {
        if (!(await alertRulesReady())) {
            return res.json({ rules: [], note: 'Apply migration 011 for system_alert_rules.' });
        }
        const q = await pool.query(
            `SELECT rule_id, name, metric_key, comparator, threshold_numeric,
                    severity, notify_email, enabled, created_at
             FROM system_alert_rules ORDER BY created_at DESC`
        );
        res.json({ rules: q.rows });
    } catch (e) {
        console.error('alert-rules list', e);
        res.status(500).json({ error: 'Failed to load alert rules' });
    }
});

router.post('/alert-rules', [
    body('name').isString().trim().isLength({ min: 3 }),
    body('metric_key').isString().trim(),
    body('comparator').isIn(['gt', 'gte', 'lt', 'lte', 'eq']),
    body('threshold_numeric').isFloat(),
    body('severity').optional().isIn(['info', 'warning', 'critical']),
    body('notify_email').optional().isEmail(),
    body('enabled').optional().isBoolean()
], async (req, res) => {
    if (!(await alertRulesReady())) {
        return res.status(503).json({ error: 'system_alert_rules missing; migration 011' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
        const ins = await pool.query(
            `INSERT INTO system_alert_rules (
                name, metric_key, comparator, threshold_numeric, severity, notify_email, enabled, created_by
            ) VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,true),$8)
            RETURNING *`,
            [
                req.body.name,
                req.body.metric_key,
                req.body.comparator,
                req.body.threshold_numeric,
                req.body.severity || 'warning',
                req.body.notify_email || null,
                req.body.enabled,
                req.user.user_id
            ]
        );
        res.status(201).json({ rule: ins.rows[0] });
    } catch (e) {
        console.error('alert-rule create', e);
        res.status(500).json({ error: 'Failed to create rule' });
    }
});

router.put('/alert-rules/:id', async (req, res) => {
    if (!(await alertRulesReady())) return res.status(503).json({ error: 'system_alert_rules missing' });
    const { id } = req.params;
    const { enabled, threshold_numeric, notify_email } = req.body;
    try {
        const r = await pool.query(
            `UPDATE system_alert_rules
             SET enabled = COALESCE($2, enabled),
                 threshold_numeric = COALESCE($3, threshold_numeric),
                 notify_email = COALESCE($4, notify_email),
                 updated_at = CURRENT_TIMESTAMP
             WHERE rule_id = $1
             RETURNING *`,
            [id, enabled ?? null, threshold_numeric ?? null, notify_email ?? null]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json({ rule: r.rows[0] });
    } catch (e) {
        console.error('alert-rule update', e);
        res.status(500).json({ error: 'Failed to update rule' });
    }
});

// =====================================================
// PUT /api/admin/users/:id/deactivate
// Deactivate a user account (admin only)
// =====================================================
router.put('/users/:id/deactivate', async (req, res) => {
    const { id } = req.params;

    try {
        const before = await pool.query(
            'SELECT user_id, username, is_active FROM users WHERE user_id = $1',
            [id]
        );

        await pool.query(
            'UPDATE users SET is_active = false WHERE user_id = $1',
            [id]
        );

        await audit(req, {
            action: 'user.deactivate',
            table_name: 'users',
            record_id: id,
            old_value: before.rows[0] || null,
            new_value: { ...(before.rows[0] || {}), is_active: false }
        });

        res.json({ success: true, message: 'User deactivated successfully' });

    } catch (error) {
        console.error('Deactivate user error:', error);
        res.status(500).json({ error: 'Failed to deactivate user' });
    }
});

module.exports = router;
