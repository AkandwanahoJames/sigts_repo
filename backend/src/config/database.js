// Database configuration - PostgreSQL connection pool

const { Pool } = require('pg');
const logger = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args)
};
const { loadEnv } = require('./env');
loadEnv();

// Validate required environment variables for database connection
function validateDatabaseConfig() {
    const isProd = process.env.NODE_ENV === 'production';
    
    // In production, require explicit configuration
    if (isProd) {
        if (!process.env.DB_PASSWORD) {
            throw new Error('CRITICAL: DB_PASSWORD environment variable must be set in production');
        }
        if (!process.env.DB_HOST || process.env.DB_HOST === 'localhost') {
            throw new Error('CRITICAL: DB_HOST must be explicitly configured in production (not localhost)');
        }
    }
}

// Create connection pool
validateDatabaseConfig();
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sigts_bwindi',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || (process.env.NODE_ENV === 'development' ? 'sigts@t' : undefined),
    max: 20,                    // Maximum connections in pool
    idleTimeoutMillis: 30000,   // Close idle connections after 30 seconds
    connectionTimeoutMillis: 2000, // Fail fast if database unavailable
    maxUses: 7500,              // Recycle connection after 7500 uses
});

// Connection event handlers
pool.on('connect', () => {
    logger.info('✅ PostgreSQL connection pool ready');
});

pool.on('error', (err) => {
    logger.error('Unexpected database error:', err);
});

// Test connection function
async function connectDB() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as time, version() as version');
        logger.info(`PostgreSQL version: ${result.rows[0].version.split(',')[0]}`);
        client.release();
        return pool;
    } catch (error) {
        logger.error('Database connection failed:', error);
        throw error;
    }
}

// Query helper with logging
async function query(text, params) {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        if (duration > 100) {
            logger.debug(`Slow query (${duration}ms): ${text}`);
        }
        return res;
    } catch (error) {
        logger.error('Query error:', { text, error: error.message });
        throw error;
    }
}

// Transaction helper
async function transaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = { pool, connectDB, query, transaction };