/**
 * IT manager database operations — monitoring, permissions, and action tracking.
 * Aligns with §4.4.3 (manage database/server, backups, security) and the
 * it_managers physical schema (access_level, capability flags, action_log).
 */

const { pool } = require('../config/database');
const { logger } = require('./logger');
const path = require('path');
const fs = require('fs');

const KEY_TABLES = [
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
    'safe_zone_violations',
    'schema_migrations',
    'park_performance_reports',
    'system_alert_rules'
];

const MIGRATIONS_DIR = path.join(__dirname, '../../../database/migrations');

function normalizeUserType(userType) {
    const raw = String(userType || '').trim().toLowerCase();
    if (raw === 'it-manager' || raw === 'itmanager') return 'it_manager';
    return raw;
}

async function getItManagerProfile(userId) {
    if (!userId) return null;
    try {
        const result = await pool.query(
            `SELECT itmanager_id, user_id, employee_id, department, access_level,
                    can_create_users, can_delete_users, can_modify_content, can_view_reports,
                    last_action_time, action_log
             FROM it_managers
             WHERE user_id = $1
             LIMIT 1`,
            [userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        logger.debug('getItManagerProfile failed:', error.message);
        return null;
    }
}

/**
 * Express middleware — enforce it_managers capability flags (admin bypasses).
 * @param {'create_users'|'delete_users'|'modify_content'|'view_reports'} capability
 */
function requireItCapability(capability) {
    const columnMap = {
        create_users: 'can_create_users',
        delete_users: 'can_delete_users',
        modify_content: 'can_modify_content',
        view_reports: 'can_view_reports'
    };

    return async (req, res, next) => {
        if (normalizeUserType(req.user?.user_type) === 'admin') {
            return next();
        }

        const profile = await getItManagerProfile(req.user?.user_id);
        if (!profile) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'IT manager profile not found for this account.'
            });
        }

        const column = columnMap[capability];
        if (!column || profile[column] !== true) {
            return res.status(403).json({
                error: 'Access denied',
                message: `Insufficient IT manager permission: ${capability}`,
                capability
            });
        }

        req.itManagerProfile = profile;
        return next();
    };
}

async function recordItManagerAction(userId, action, detail = {}) {
    if (!userId || !action) return;

    try {
        const current = await pool.query(
            'SELECT action_log FROM it_managers WHERE user_id = $1 LIMIT 1',
            [userId]
        );
        if (!current.rows.length) return;

        const existing = Array.isArray(current.rows[0].action_log) ? current.rows[0].action_log : [];
        const entry = {
            action: String(action).slice(0, 120),
            at: new Date().toISOString(),
            ...detail
        };
        const trimmed = [...existing, entry].slice(-50);

        await pool.query(
            `UPDATE it_managers
             SET last_action_time = CURRENT_TIMESTAMP,
                 action_log = $2::jsonb
             WHERE user_id = $1`,
            [userId, JSON.stringify(trimmed)]
        );
    } catch (error) {
        logger.warn('recordItManagerAction failed:', error.message);
    }
}

async function getDatabaseMeta() {
    const meta = {
        name: process.env.DB_NAME || 'sigts_bwindi',
        size_bytes: null,
        postgres_version: null,
        active_connections: null,
        pool_total: null,
        pool_idle: null,
        pool_waiting: null
    };

    try {
        const [sizeQ, versionQ, connQ] = await Promise.all([
            pool.query('SELECT pg_database_size(current_database())::bigint AS size_bytes'),
            pool.query('SELECT version() AS version'),
            pool.query(
                `SELECT COUNT(*)::int AS active
                 FROM pg_stat_activity
                 WHERE datname = current_database()
                   AND state IS DISTINCT FROM 'idle'`
            )
        ]);
        meta.size_bytes = Number(sizeQ.rows[0]?.size_bytes) || null;
        meta.postgres_version = versionQ.rows[0]?.version || null;
        meta.active_connections = Number(connQ.rows[0]?.active) || 0;
    } catch (error) {
        logger.debug('getDatabaseMeta partial failure:', error.message);
    }

    if (pool.totalCount != null) {
        meta.pool_total = pool.totalCount;
        meta.pool_idle = pool.idleCount;
        meta.pool_waiting = pool.waitingCount;
    }

    return meta;
}

async function getMigrationStatus() {
    const status = {
        applied: 0,
        pending: 0,
        latest_applied: null,
        pending_files: []
    };

    let appliedNames = [];
    try {
        const appliedQ = await pool.query(
            `SELECT migration_name, applied_at
             FROM schema_migrations
             ORDER BY id ASC`
        );
        appliedNames = appliedQ.rows.map((r) => r.migration_name);
        status.applied = appliedNames.length;
        status.latest_applied = appliedNames[appliedNames.length - 1] || null;
        status.applied_at = appliedQ.rows[appliedQ.rows.length - 1]?.applied_at || null;
    } catch (_) {
        /** schema_migrations may not exist on legacy DBs */
    }

    try {
        if (fs.existsSync(MIGRATIONS_DIR)) {
            const diskFiles = fs
                .readdirSync(MIGRATIONS_DIR)
                .filter((f) => f.endsWith('.sql'))
                .sort();
            const appliedSet = new Set(appliedNames);
            status.pending_files = diskFiles.filter((f) => !appliedSet.has(f));
            status.pending = status.pending_files.length;
            status.total_on_disk = diskFiles.length;
        }
    } catch (_) {
        /** ignore */
    }

    return status;
}

async function getSchemaTableStatus(tables = KEY_TABLES) {
    const status = {};
    const uniqueTables = [...new Set(tables)];

    let statsByTable = {};
    try {
        const statsQ = await pool.query(
            `SELECT relname AS table_name,
                    n_live_tup::bigint AS approx_rows,
                    last_vacuum,
                    last_analyze,
                    last_autoanalyze
             FROM pg_stat_user_tables
             WHERE schemaname = 'public'`
        );
        statsByTable = Object.fromEntries(statsQ.rows.map((r) => [r.table_name, r]));
    } catch (_) {
        /** pg_stat may be unavailable */
    }

    await Promise.all(
        uniqueTables.map(async (table) => {
            try {
                const exists = await pool.query(
                    `SELECT 1
                     FROM information_schema.tables
                     WHERE table_schema = 'public' AND table_name = $1
                     LIMIT 1`,
                    [table]
                );
                if (!exists.rows.length) {
                    status[table] = { exists: false, count: 0, status: 'missing' };
                    return;
                }

                const stat = statsByTable[table];
                const countResult = await pool.query(
                    `SELECT COUNT(*)::int AS count FROM ${table}`
                );
                status[table] = {
                    exists: true,
                    count: Number(countResult.rows[0]?.count || 0),
                    approx_rows: stat ? Number(stat.approx_rows) || 0 : null,
                    status: 'active',
                    last_vacuum: stat?.last_vacuum || null,
                    last_analyze: stat?.last_analyze || stat?.last_autoanalyze || null
                };
            } catch (error) {
                status[table] = {
                    exists: true,
                    count: null,
                    status: 'error',
                    error: error.message
                };
            }
        })
    );

    return status;
}

async function runAnalyzeOnKeyTables(tables = KEY_TABLES) {
    const analyzed = [];
    const skipped = [];

    for (const table of [...new Set(tables)]) {
        try {
            const exists = await pool.query(
                `SELECT 1 FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
                [table]
            );
            if (!exists.rows.length) {
                skipped.push({ table, reason: 'missing' });
                continue;
            }
            await pool.query(`ANALYZE ${table}`);
            analyzed.push(table);
        } catch (error) {
            skipped.push({ table, reason: error.message });
        }
    }

    return { analyzed, skipped };
}

module.exports = {
    KEY_TABLES,
    normalizeUserType,
    getItManagerProfile,
    requireItCapability,
    recordItManagerAction,
    getDatabaseMeta,
    getMigrationStatus,
    getSchemaTableStatus,
    runAnalyzeOnKeyTables
};
