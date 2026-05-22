// Shared PostgreSQL pool options (local, Supabase, Render, Vercel)

function requiresSsl() {
    if (process.env.DB_SSL === 'true') return true;
    if (process.env.DB_SSL === 'false') return false;

    const host = (process.env.DB_HOST || '').toLowerCase();
    const url = (process.env.DATABASE_URL || '').toLowerCase();
    return (
        process.env.NODE_ENV === 'production'
        || host.includes('supabase')
        || url.includes('supabase')
    );
}

function getPgPoolConfig() {
    const poolSizing = {
        max: Number.parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 20,
        idleTimeoutMillis: Number.parseInt(process.env.DB_IDLE_TIMEOUT_MS, 10) || 30000,
        connectionTimeoutMillis: Number.parseInt(process.env.DB_CONNECTION_TIMEOUT_MS, 10) || 2000,
        maxUses: 7500,
    };

    if (process.env.DATABASE_URL) {
        const config = {
            connectionString: process.env.DATABASE_URL,
            ...poolSizing,
        };
        if (requiresSsl()) {
            config.ssl = { rejectUnauthorized: false };
        }
        return config;
    }

    const config = {
        host: process.env.DB_HOST || 'localhost',
        port: Number.parseInt(process.env.DB_PORT, 10) || 5432,
        database: process.env.DB_NAME || 'sigts_bwindi',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || (process.env.NODE_ENV === 'development' ? 'sigts@t' : undefined),
        ...poolSizing,
    };

    if (requiresSsl()) {
        config.ssl = { rejectUnauthorized: false };
    }

    return config;
}

function validateDatabaseEnv() {
    const isProd = process.env.NODE_ENV === 'production';

    if (!isProd) return;

    const hasUrl = Boolean(process.env.DATABASE_URL);
    const hasDiscrete = Boolean(process.env.DB_PASSWORD);

    if (!hasUrl && !hasDiscrete) {
        throw new Error('CRITICAL: set DATABASE_URL or DB_PASSWORD in production');
    }

    if (!hasUrl && (!process.env.DB_HOST || process.env.DB_HOST === 'localhost')) {
        throw new Error('CRITICAL: DB_HOST must be set in production (or use DATABASE_URL)');
    }
}

module.exports = { getPgPoolConfig, validateDatabaseEnv, requiresSsl };
