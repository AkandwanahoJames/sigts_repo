// backend/src/routes/admin.js
const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateJWT, authorize } = require('../middleware/auth');
const { hashPassword } = require('../config/auth');
const { audit } = require('../utils/audit');
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const execFileAsync = promisify(execFile);

// IT operations desk: IT managers and system admins (user_type admin)
router.use(authenticateJWT, authorize('it_manager', 'admin'));

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
            cacheHitRate: null,
            cacheHitNote:
                'Cache hit rate is not tracked in this deployment (no Redis-backed edge cache metrics).'
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
            ? `SELECT user_id, username, first_name, last_name, user_type, email,
                      COALESCE(last_location_time, last_login) AS last_seen,
                      last_login, last_lat, last_lng
               FROM users
               WHERE is_active = true
                 AND COALESCE(last_location_time, last_login) IS NOT NULL
                 AND COALESCE(last_location_time, last_login) > NOW() - ($1)::interval
               ORDER BY COALESCE(last_location_time, last_login) DESC`
            : `SELECT user_id, username, first_name, last_name, user_type, email,
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
            name: [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.username,
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

    const {
        normalizeUsername,
        normalizeEmail,
        findRegistrationConflicts,
        registrationConflictResponse,
        mapUniqueViolation
    } = require('../utils/userIdentity');

    const { username, email, password, first_name, last_name, phone, user_type } = req.body;
    const usernameNorm = normalizeUsername(username);
    const emailNorm = normalizeEmail(email);

    try {
        const conflicts = await findRegistrationConflicts(pool, username, email);
        const conflictResp = registrationConflictResponse(conflicts);
        if (conflictResp) {
            return res.status(conflictResp.status).json(conflictResp.body);
        }

        const hashedPassword = await hashPassword(password);

        const result = await pool.query(
            `INSERT INTO users (user_id, username, password_hash, email, first_name, last_name, phone, user_type)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
             RETURNING user_id, username, email, user_type`,
            [usernameNorm, hashedPassword, emailNorm, first_name, last_name, phone, user_type]
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
        const unique = mapUniqueViolation(error);
        if (unique) {
            return res.status(unique.status).json(unique.body);
        }
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
        const backupScript = path.join(__dirname, '../../scripts/backup.js');
        const startedAt = Date.now();
        const run = await execFileAsync(process.execPath, [backupScript, 'backup'], {
            cwd: path.join(__dirname, '../..'),
            timeout: 120000
        });
        const stdout = String(run.stdout || '');
        const stderr = String(run.stderr || '');
        const fileMatch = stdout.match(/Output:\s*(.+)$/m);
        const backupPath = fileMatch ? fileMatch[1].trim() : null;
        const backupId = backupPath ? path.basename(backupPath) : `backup_${startedAt}`;
        const fileStats = backupPath && fs.existsSync(backupPath) ? fs.statSync(backupPath) : null;

        await pool.query(
            `INSERT INTO park_performance_reports (report_id, report_type, period_start, period_end, metrics, generated_by)
             VALUES (gen_random_uuid(), 'backup', CURRENT_DATE, CURRENT_DATE, $1, $2)`,
            [
                JSON.stringify({
                    backupId,
                    status: 'created',
                    backup_path: backupPath,
                    size_bytes: fileStats ? Number(fileStats.size) : null,
                    elapsed_ms: Date.now() - startedAt,
                    stderr: stderr || null
                }),
                req.user.user_id
            ]
        );

        res.json({
            success: true,
            backup_id: backupId,
            backup_path: backupPath,
            size_bytes: fileStats ? Number(fileStats.size) : null,
            message: 'Backup created'
        });

    } catch (error) {
        console.error('Create backup error:', error);
        res.status(500).json({ error: `Failed to create backup: ${error.message}` });
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
// Deactivate a user account (IT manager / admin)
// =====================================================
router.put('/users/:id/deactivate', async (req, res) => {
    const { id } = req.params;

    try {
        const before = await pool.query(
            'SELECT user_id, username, is_active FROM users WHERE user_id = $1',
            [id]
        );

        if (before.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (before.rows[0].is_active === false) {
            return res.json({ success: true, message: 'Account was already inactive', alreadyInactive: true });
        }

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

// =====================================================
// GET /api/admin/audit-logs
// Recent audit log entries for IT manager review.
// =====================================================
router.get('/audit-logs', [
    query('limit').optional().isInt({ min: 1, max: 500 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const limit = Number.parseInt(req.query.limit, 10) || 100;
    try {
        const result = await pool.query(
            `SELECT
                a.id,
                a.action,
                a.table_name,
                a.record_id,
                a.old_value,
                a.new_value,
                a.ip_address,
                a.user_agent,
                a.created_at,
                u.username,
                u.user_type
             FROM audit_logs a
             LEFT JOIN users u ON u.user_id = a.user_id
             ORDER BY a.created_at DESC
             LIMIT $1`,
            [limit]
        );
        res.json({ logs: result.rows, limit });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Failed to load audit logs' });
    }
});

// =====================================================
// GET /api/admin/system-health
// Light operational health snapshot.
// =====================================================
router.get('/system-health', async (req, res) => {
    try {
        const dbResult = await pool.query('SELECT NOW() AS now');
        const syncQueue = await pool.query(
            `SELECT
                COUNT(*) FILTER (WHERE status = 'pending') AS pending,
                COUNT(*) AS total
             FROM sync_queue`
        );
        const geofencePulse = await pool.query(
            `SELECT COUNT(*) AS updates_last_15m
             FROM location_history
             WHERE captured_at > NOW() - INTERVAL '15 minutes'`
        );
        const feedbackPulse = await pool.query(
            `SELECT COUNT(*) AS feedback_last_24h
             FROM feedback
             WHERE created_at > NOW() - INTERVAL '24 hours'`
        );

        res.json({
            database: dbResult.rows.length ? 'connected' : 'degraded',
            syncService: Number(syncQueue.rows[0]?.pending || 0) >= 0 ? 'running' : 'degraded',
            geolocation: Number(geofencePulse.rows[0]?.updates_last_15m || 0) > 0 ? 'active' : 'idle',
            feedbackIngest: Number(feedbackPulse.rows[0]?.feedback_last_24h || 0) >= 0 ? 'active' : 'idle',
            checks: {
                db_time: dbResult.rows[0]?.now || null,
                pending_sync_items: Number(syncQueue.rows[0]?.pending || 0),
                total_sync_items: Number(syncQueue.rows[0]?.total || 0),
                location_updates_last_15m: Number(geofencePulse.rows[0]?.updates_last_15m || 0),
                feedback_last_24h: Number(feedbackPulse.rows[0]?.feedback_last_24h || 0)
            }
        });
    } catch (error) {
        console.error('Get system health error:', error);
        res.status(500).json({ error: 'Failed to load system health' });
    }
});

// =====================================================
// GET /api/admin/schema-status
// Reports table row counts for key operational tables.
// =====================================================
router.get('/schema-status', async (req, res) => {
    const tables = [
        'users',
        'tourists',
        'tour_guides',
        'it_managers',
        'parks',
        'locations',
        'animals',
        'sightings',
        'cultural_narratives',
        'tour_routes',
        'tour_sessions',
        'safety_tips',
        'faqs',
        'feedback',
        'sync_queue',
        'audit_logs',
        'park_safe_zones',
        'safe_zone_violations'
    ];

    try {
        const status = {};
        for (const table of tables) {
            const exists = await pool.query(
                `SELECT 1
                 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = $1
                 LIMIT 1`,
                [table]
            );
            if (!exists.rows.length) {
                status[table] = { exists: false, count: 0, status: 'missing' };
                continue;
            }
            const countResult = await pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
            status[table] = {
                exists: true,
                count: Number(countResult.rows[0]?.count || 0),
                status: 'active'
            };
        }
        res.json({ status });
    } catch (error) {
        console.error('Get schema status error:', error);
        res.status(500).json({ error: 'Failed to load schema status' });
    }
});

// =====================================================
// POI / locations (IT manager)
// =====================================================
const LOCATION_TYPES = ['waterhole', 'viewpoint', 'camp', 'gate', 'trail', 'ranger_post'];

router.get('/locations', [query('limit').optional().isInt({ min: 1, max: 500 })], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const limit = Number.parseInt(req.query.limit, 10) || 200;
    try {
        const result = await pool.query(
            `SELECT location_id, name, description, location_type,
                    ST_Y(coordinates) AS latitude, ST_X(coordinates) AS longitude,
                    trigger_radius, best_viewing_time, updated_at
             FROM locations
             ORDER BY name ASC
             LIMIT $1`,
            [limit]
        );
        return res.json({ locations: result.rows });
    } catch (error) {
        console.error('admin list locations', error);
        return res.status(500).json({ error: 'Failed to list locations' });
    }
});

router.post(
    '/locations',
    [
        body('name').isString().trim().isLength({ min: 2, max: 200 }),
        body('location_type').isIn(LOCATION_TYPES),
        body('latitude').isFloat({ min: -90, max: 90 }),
        body('longitude').isFloat({ min: -180, max: 180 }),
        body('description').optional().isString().isLength({ max: 4000 }),
        body('trigger_radius').optional().isInt({ min: 5, max: 5000 }),
        body('best_viewing_time').optional().isString().isLength({ max: 200 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        const { name, location_type, latitude, longitude, description, trigger_radius, best_viewing_time } = req.body;
        try {
            const park = await pool.query('SELECT park_id FROM parks ORDER BY name ASC LIMIT 1');
            if (!park.rows.length) {
                return res.status(400).json({ error: 'No park configured — seed parks before adding POIs.' });
            }
            const ins = await pool.query(
                `INSERT INTO locations (
                    name, description, location_type, coordinates, trigger_radius, best_viewing_time, park_id
                ) VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7, $8)
                RETURNING location_id, name, location_type`,
                [
                    name.trim(),
                    description != null ? String(description) : null,
                    location_type,
                    Number(longitude),
                    Number(latitude),
                    Number.isFinite(Number(trigger_radius)) ? Number(trigger_radius) : 50,
                    best_viewing_time != null ? String(best_viewing_time) : null,
                    park.rows[0].park_id
                ]
            );
            await audit(req, {
                action: 'location.create',
                table_name: 'locations',
                record_id: ins.rows[0].location_id,
                new_value: ins.rows[0]
            });
            return res.status(201).json({ success: true, location: ins.rows[0] });
        } catch (error) {
            console.error('admin create location', error);
            return res.status(500).json({ error: 'Failed to create location' });
        }
    }
);

router.put(
    '/locations/:id',
    [
        body('name').optional().isString().trim().isLength({ min: 2, max: 200 }),
        body('location_type').optional().isIn(LOCATION_TYPES),
        body('latitude').optional().isFloat({ min: -90, max: 90 }),
        body('longitude').optional().isFloat({ min: -180, max: 180 }),
        body('description').optional().isString().isLength({ max: 4000 }),
        body('trigger_radius').optional().isInt({ min: 5, max: 5000 }),
        body('best_viewing_time').optional().isString().isLength({ max: 200 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        const { id } = req.params;
        try {
            const cur = await pool.query(
                `SELECT location_id, name, description, location_type, trigger_radius, best_viewing_time,
                        ST_Y(coordinates) AS latitude, ST_X(coordinates) AS longitude
                 FROM locations WHERE location_id = $1`,
                [id]
            );
            if (!cur.rows.length) return res.status(404).json({ error: 'Location not found' });
            const row = cur.rows[0];
            const name = req.body.name != null ? String(req.body.name).trim() : row.name;
            const location_type = req.body.location_type || row.location_type;
            const lat = Number.isFinite(Number(req.body.latitude))
                ? Number(req.body.latitude)
                : Number(row.latitude);
            const lng = Number.isFinite(Number(req.body.longitude))
                ? Number(req.body.longitude)
                : Number(row.longitude);
            const description = req.body.description !== undefined ? req.body.description : row.description;
            const trigger_radius = Number.isFinite(Number(req.body.trigger_radius))
                ? Number(req.body.trigger_radius)
                : row.trigger_radius;
            const best_viewing_time =
                req.body.best_viewing_time !== undefined ? req.body.best_viewing_time : row.best_viewing_time;

            const upd = await pool.query(
                `UPDATE locations SET
                    name = $1,
                    description = $2,
                    location_type = $3,
                    coordinates = ST_SetSRID(ST_MakePoint($4, $5), 4326),
                    trigger_radius = $6,
                    best_viewing_time = $7,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE location_id = $8
                 RETURNING location_id, name, location_type, description,
                           ST_Y(coordinates) AS latitude, ST_X(coordinates) AS longitude,
                           trigger_radius, best_viewing_time`,
                [name, description, location_type, lng, lat, trigger_radius, best_viewing_time, id]
            );
            await audit(req, {
                action: 'location.update',
                table_name: 'locations',
                record_id: id,
                old_value: row,
                new_value: upd.rows[0]
            });
            return res.json({ success: true, location: upd.rows[0] });
        } catch (error) {
            console.error('admin update location', error);
            return res.status(500).json({ error: 'Failed to update location' });
        }
    }
);

router.delete('/locations/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const del = await pool.query('DELETE FROM locations WHERE location_id = $1 RETURNING location_id', [id]);
        if (!del.rows.length) return res.status(404).json({ error: 'Location not found' });
        await audit(req, { action: 'location.delete', table_name: 'locations', record_id: id });
        return res.json({ success: true, deleted: id });
    } catch (error) {
        console.error('admin delete location', error);
        return res.status(409).json({
            error: 'Cannot delete this POI while other records still reference it.',
            detail: String(error.message || error)
        });
    }
});

// =====================================================
// Park geofence boundary (GeoJSON Polygon)
// =====================================================
router.put(
    '/parks/boundary',
    [body('geojson').isObject(), body('geojson.type').equals('Polygon')],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        const gj = req.body.geojson;
        try {
            const gjStr = JSON.stringify(gj);
            await pool.query(
                `UPDATE parks
                 SET geofence_boundary = ST_GeomFromGeoJSON($1::text)::geometry
                 WHERE park_id = (SELECT park_id FROM parks ORDER BY name ASC LIMIT 1)`,
                [gjStr]
            );
            await audit(req, {
                action: 'park.boundary_update',
                table_name: 'parks',
                record_id: 'primary',
                new_value: { type: gj.type, ring_count: Array.isArray(gj.coordinates) ? gj.coordinates.length : 0 }
            });
            return res.json({
                success: true,
                message: 'Park boundary updated. Clients should refresh maps on next session.'
            });
        } catch (error) {
            console.error('admin park boundary', error);
            return res.status(400).json({
                error: 'Invalid polygon for PostGIS — ensure GeoJSON is a single closed ring in WGS84.',
                detail: String(error.message || error)
            });
        }
    }
);

// =====================================================
// Safe zones (mandatory visitor corridors)
// =====================================================
router.get('/safe-zones', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT safe_zone_id, park_id, name, is_mandatory,
                    ST_AsGeoJSON(boundary)::json AS geojson,
                    created_at, updated_at
             FROM park_safe_zones
             ORDER BY name ASC`
        );
        return res.json({ safe_zones: result.rows });
    } catch (error) {
        if (error.code === '42P01') return res.json({ safe_zones: [], note: 'Migration 014 not applied.' });
        console.error('admin safe-zones list', error);
        return res.status(500).json({ error: 'Failed to list safe zones' });
    }
});

router.post(
    '/safe-zones',
    [
        body('name').isString().trim().isLength({ min: 2, max: 200 }),
        body('is_mandatory').isBoolean(),
        body('geojson').isObject(),
        body('geojson.type').equals('Polygon')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const park = await pool.query('SELECT park_id FROM parks ORDER BY name ASC LIMIT 1');
            if (!park.rows.length) {
                return res.status(400).json({ error: 'No park configured.' });
            }
            const gjStr = JSON.stringify(req.body.geojson);
            const ins = await pool.query(
                `INSERT INTO park_safe_zones (park_id, name, is_mandatory, boundary)
                 VALUES ($1, $2, $3, ST_GeomFromGeoJSON($4::text)::geometry)
                 RETURNING safe_zone_id, name, is_mandatory`,
                [park.rows[0].park_id, req.body.name.trim(), Boolean(req.body.is_mandatory), gjStr]
            );
            await audit(req, {
                action: 'safe_zone.create',
                table_name: 'park_safe_zones',
                record_id: ins.rows[0].safe_zone_id,
                new_value: ins.rows[0]
            });
            return res.status(201).json({ success: true, safe_zone: ins.rows[0] });
        } catch (error) {
            if (error.code === '42P01') {
                return res.status(503).json({
                    error: 'Database migration 014 (park_safe_zones) is not applied on this server.'
                });
            }
            console.error('admin safe-zone create', error);
            return res.status(400).json({
                error: 'Could not store safe zone polygon.',
                detail: String(error.message || error)
            });
        }
    }
);

router.delete('/safe-zones/:id', async (req, res) => {
    try {
        const del = await pool.query('DELETE FROM park_safe_zones WHERE safe_zone_id = $1 RETURNING safe_zone_id', [
            req.params.id
        ]);
        if (!del.rows.length) return res.status(404).json({ error: 'Safe zone not found' });
        await audit(req, { action: 'safe_zone.delete', table_name: 'park_safe_zones', record_id: req.params.id });
        return res.json({ success: true, deleted: req.params.id });
    } catch (error) {
        if (error.code === '42P01') return res.status(503).json({ error: 'Migration 014 not applied.' });
        console.error('admin safe-zone delete', error);
        return res.status(500).json({ error: 'Failed to delete safe zone' });
    }
});

router.get(
    '/safe-zone-violations',
    [query('limit').optional().isInt({ min: 1, max: 200 }), query('unacked').optional().isBoolean()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        const limit = Number.parseInt(req.query.limit, 10) || 40;
        const unacked = String(req.query.unacked || 'true').toLowerCase() === 'true';
        try {
            const result = await pool.query(
                `SELECT v.violation_id, v.user_id, u.username, v.latitude, v.longitude,
                        v.violation_kind, v.detail, v.created_at, v.acknowledged, v.acknowledged_at
                 FROM safe_zone_violations v
                 JOIN users u ON u.user_id = v.user_id
                 WHERE ($1::boolean = false OR v.acknowledged = false)
                 ORDER BY v.created_at DESC
                 LIMIT $2`,
                [unacked, limit]
            );
            return res.json({ violations: result.rows });
        } catch (error) {
            if (error.code === '42P01') return res.json({ violations: [], note: 'Migration 014 not applied.' });
            console.error('admin safe-zone violations', error);
            return res.status(500).json({ error: 'Failed to load violations' });
        }
    }
);

router.put('/safe-zone-violations/:id/ack', async (req, res) => {
    try {
        const result = await pool.query(
            `UPDATE safe_zone_violations
             SET acknowledged = true,
                 acknowledged_at = CURRENT_TIMESTAMP,
                 acknowledged_by = $2
             WHERE violation_id = $1 AND acknowledged = false
             RETURNING violation_id`,
            [req.params.id, req.user.user_id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Violation not found or already acknowledged' });
        await audit(req, {
            action: 'safe_zone_violation.ack',
            table_name: 'safe_zone_violations',
            record_id: req.params.id
        });
        return res.json({ success: true });
    } catch (error) {
        if (error.code === '42P01') return res.status(503).json({ error: 'Migration 014 not applied.' });
        console.error('ack safe zone violation', error);
        return res.status(500).json({ error: 'Failed to acknowledge violation' });
    }
});

module.exports = router;
