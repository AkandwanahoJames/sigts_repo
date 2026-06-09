// Shared PostgreSQL pool options (local, Supabase, Render, Vercel)

function resolveDatabaseUrl() {
    if (process.env.DATABASE_URL) {
        return adaptDatabaseUrlForServerless(process.env.DATABASE_URL);
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

/** Vercel is IPv4-only; Supabase direct `db.*.supabase.co:5432` is IPv6-only. Use transaction pooler. */
function adaptDatabaseUrlForServerless(url) {
    if (!url || !process.env.VERCEL) {
        return url;
    }
    if (url.includes('pooler.supabase.com')) {
        return url;
    }

    const directMatch = url.match(
        /^postgres(?:ql)?:\/\/([^:@/]+)(?::([^@/]*))?@db\.([a-z0-9]+)\.supabase\.co:5432\/([^?]+)(\?.*)?$/i
    );
    if (!directMatch) {
        return url;
    }

    const [, user, password, ref, dbName, query = ''] = directMatch;
    const poolUser = user.includes('.') ? user : `postgres.${ref}`;
    const authPart = password !== undefined && password !== '' ? `${poolUser}:${password}` : poolUser;
    const poolQuery = query.includes('pgbouncer=') ? query : `${query ? `${query}&` : '?'}pgbouncer=true`;

    // Shared pooler on the same project host (IPv4) — works on many Supabase projects.
    const sharedPoolerUrl = `postgresql://${authPart}@db.${ref}.supabase.co:6543/${dbName}${poolQuery}`;
    if (process.env.SUPABASE_POOLER_MODE === 'shared') {
        return sharedPoolerUrl;
    }

    const generation = (process.env.SUPABASE_POOLER_AWS_GENERATION || '0').trim();
    const region = (process.env.SUPABASE_POOLER_REGION || 'us-east-1').trim();
    const port = process.env.SUPABASE_POOLER_MODE === 'session' ? '5432' : '6543';

    return `postgresql://${authPart}@aws-${generation}-${region}.pooler.supabase.com:${port}/${dbName}${poolQuery}`;
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
    const isServerless = Boolean(process.env.VERCEL);
    const poolSizing = {
        max: Number.parseInt(process.env.DB_MAX_CONNECTIONS, 10) || (isServerless ? 1 : 20),
        idleTimeoutMillis: Number.parseInt(process.env.DB_IDLE_TIMEOUT_MS, 10) || (isServerless ? 10000 : 30000),
        connectionTimeoutMillis:
            Number.parseInt(process.env.DB_CONNECTION_TIMEOUT_MS, 10) || (isServerless ? 12000 : 2000),
        maxUses: isServerless ? 1 : 7500,
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

module.exports = { getPgPoolConfig, validateDatabaseEnv, requiresSsl, resolveDatabaseUrl, adaptDatabaseUrlForServerless };
