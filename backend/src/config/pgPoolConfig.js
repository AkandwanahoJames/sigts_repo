// Shared PostgreSQL pool options (local, Supabase, Render, Vercel)

function resolveDatabaseUrl() {
    if (process.env.DATABASE_URL) {
        return process.env.DATABASE_URL;
    }

    let supabaseUrl = (process.env.SUPABASE_URL || '').trim();
    const projectRef = (process.env.SUPABASE_PROJECT_REF || '').trim();
    if (!supabaseUrl && projectRef) {
        supabaseUrl = `https://${projectRef}.supabase.co`;
    }
    const password = process.env.SUPABASE_DB_PASSWORD || process.env.DB_PASSWORD;
    if (!supabaseUrl || !password) {
        return null;
    }

    const refMatch = supabaseUrl.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co\/?$/i);
    if (!refMatch) {
        return null;
    }

    const ref = refMatch[1];
    const encoded = encodeURIComponent(password);
    return `postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`;
}

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

    const useSupabase = String(process.env.USE_SUPABASE || '').toLowerCase() === 'true';
    const databaseUrl = resolveDatabaseUrl();
    if (databaseUrl) {
        const config = {
            connectionString: databaseUrl,
            ...poolSizing,
        };
        if (requiresSsl()) {
            config.ssl = { rejectUnauthorized: false };
        }
        return config;
    }

    if (useSupabase) {
        throw new Error(
            'USE_SUPABASE=true but no database URL. Set DATABASE_URL, SUPABASE_URL, or SUPABASE_PROJECT_REF in backend/.env'
        );
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

    const hasUrl = Boolean(resolveDatabaseUrl());
    const hasDiscrete = Boolean(process.env.DB_PASSWORD);

    if (!hasUrl && !hasDiscrete) {
        throw new Error('CRITICAL: set DATABASE_URL or DB_PASSWORD in production');
    }

    if (!hasUrl && (!process.env.DB_HOST || process.env.DB_HOST === 'localhost')) {
        throw new Error('CRITICAL: DB_HOST must be set in production (or use DATABASE_URL)');
    }
}

module.exports = { getPgPoolConfig, validateDatabaseEnv, requiresSsl, resolveDatabaseUrl };
