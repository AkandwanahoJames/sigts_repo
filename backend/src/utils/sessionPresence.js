const { pool } = require('../config/database');
const { logger } = require('./logger');

let hasLastLocationTimeColumn = null;

async function ensureLastLocationTimeColumn() {
    if (hasLastLocationTimeColumn !== null) return hasLastLocationTimeColumn;
    try {
        const r = await pool.query(
            `SELECT 1
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'users'
               AND column_name = 'last_location_time'
             LIMIT 1`
        );
        hasLastLocationTimeColumn = r.rows.length > 0;
    } catch (_) {
        hasLastLocationTimeColumn = false;
    }
    return hasLastLocationTimeColumn;
}

/**
 * Record that a user session is active (login, API heartbeat, or presence ping).
 * Updates last_login always; updates last_location_time when the column exists.
 */
async function touchUserSessionActivity(userId, coords = null) {
    if (!userId) return false;
    const lat = coords && Number.isFinite(Number(coords.lat)) ? Number(coords.lat) : null;
    const lng = coords && Number.isFinite(Number(coords.lng)) ? Number(coords.lng) : null;
    const hasCoords = lat != null && lng != null;
    const hasCol = await ensureLastLocationTimeColumn();

    try {
        if (hasCol) {
            if (hasCoords) {
                await pool.query(
                    `UPDATE users
                     SET last_login = CURRENT_TIMESTAMP,
                         last_location_time = CURRENT_TIMESTAMP,
                         last_lat = $1,
                         last_lng = $2
                     WHERE user_id = $3 AND is_active = true`,
                    [lat, lng, userId]
                );
            } else {
                await pool.query(
                    `UPDATE users
                     SET last_login = CURRENT_TIMESTAMP,
                         last_location_time = CURRENT_TIMESTAMP
                     WHERE user_id = $1 AND is_active = true`,
                    [userId]
                );
            }
        } else {
            await pool.query(
                `UPDATE users
                 SET last_login = CURRENT_TIMESTAMP
                 WHERE user_id = $1 AND is_active = true`,
                [userId]
            );
        }
        return true;
    } catch (error) {
        logger.debug('touchUserSessionActivity failed:', error.message);
        try {
            await pool.query(
                `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1 AND is_active = true`,
                [userId]
            );
            return true;
        } catch (fallbackError) {
            logger.debug('touchUserSessionActivity fallback failed:', fallbackError.message);
            return false;
        }
    }
}

/** SQL fragment when last_location_time column exists (legacy static export). */
const LAST_ACTIVITY_SQL = `GREATEST(
    COALESCE(last_location_time, '1970-01-01'::timestamptz),
    COALESCE(last_login, '1970-01-01'::timestamptz)
)`;

let cachedLastActivitySql = null;

/** Resolves activity SQL safely when last_location_time migration is not applied. */
async function resolveLastActivitySql() {
    if (cachedLastActivitySql) return cachedLastActivitySql;
    const hasCol = await ensureLastLocationTimeColumn();
    cachedLastActivitySql = hasCol
        ? `GREATEST(
            COALESCE(last_location_time, '1970-01-01'::timestamptz),
            COALESCE(last_login, '1970-01-01'::timestamptz)
        )`
        : `COALESCE(last_login, '1970-01-01'::timestamptz)`;
    return cachedLastActivitySql;
}

/** WHERE clause binding for users active within a sliding window. */
function activeUsersWithinWindowClause(paramIndex = 1) {
    return `is_active = true AND ${LAST_ACTIVITY_SQL} > NOW() - ($${paramIndex})::interval`;
}

async function buildActiveUsersWithinWindowClause(paramIndex = 1) {
    const activitySql = await resolveLastActivitySql();
    return `is_active = true AND ${activitySql} > NOW() - ($${paramIndex})::interval`;
}

module.exports = {
    touchUserSessionActivity,
    LAST_ACTIVITY_SQL,
    activeUsersWithinWindowClause,
    buildActiveUsersWithinWindowClause,
    resolveLastActivitySql,
    ensureLastLocationTimeColumn
};
