/* One-off: test Supabase connection URL variants. Usage: node scripts/test-supabase-urls.js */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function loadSupabaseEnv() {
    const envPath = path.join(__dirname, '..', '.env.supabase');
    const vars = {};
    if (!fs.existsSync(envPath)) return vars;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const m = line.match(/^\s*([^#=]+)=(.*)$/);
        if (m) vars[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
    }
    return vars;
}

async function tryUrl(name, url) {
    const pool = new Pool({
        connectionString: url,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
        max: 1,
    });
    try {
        await pool.query('SELECT 1 AS ok');
        console.log('OK', name);
        await pool.end();
        return true;
    } catch (err) {
        console.log('FAIL', name, String(err.message).split('\n')[0]);
        await pool.end().catch(() => {});
        return false;
    }
}

async function dnsOk(hostname) {
    const dns = require('dns').promises;
    try {
        await dns.lookup(hostname);
        return true;
    } catch (_) {
        return false;
    }
}

async function main() {
    const vars = loadSupabaseEnv();
    const ref = vars.SUPABASE_PROJECT_REF || 'hjculkldwjrsifvnaugy';
    const projectHost = `${ref}.supabase.co`;
    if (!(await dnsOk(projectHost)) && !(await dnsOk(`db.${ref}.supabase.co`))) {
        console.error(
            `FAIL project-dns ${projectHost} does not resolve — Supabase project may be deleted, paused, or the ref is wrong.`
        );
        process.exit(1);
    }
    const region = vars.SUPABASE_POOLER_REGION || 'eu-west-1';
    const pass = vars.DATABASE_PASSWORD || '';
    const pooler = vars.DATABASE_URL_POOLER || '';
    const direct = vars.DATABASE_URL_DIRECT || '';

    const enc = encodeURIComponent(pass);
    const candidates = [
        ['env-pooler', pooler],
        ['env-direct', direct],
        ['txn-6543-aws0', `postgresql://postgres.${ref}:${enc}@aws-0-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true`],
        ['txn-6543-aws1', `postgresql://postgres.${ref}:${enc}@aws-1-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true`],
        ['sess-5432-aws0', `postgresql://postgres.${ref}:${enc}@aws-0-${region}.pooler.supabase.com:5432/postgres`],
        ['sess-5432-aws1', `postgresql://postgres.${ref}:${enc}@aws-1-${region}.pooler.supabase.com:5432/postgres`],
        ['shared-6543', `postgresql://postgres.${ref}:${enc}@db.${ref}.supabase.co:6543/postgres?pgbouncer=true`],
        ['direct-5432', `postgresql://postgres:${enc}@db.${ref}.supabase.co:5432/postgres`],
    ].filter(([, url]) => url && !url.includes('YOUR_PASSWORD'));

    for (const [name, url] of candidates) {
        if (await tryUrl(name, url)) {
            console.log('USE_THIS_VARIANT', name);
            return;
        }
    }
    console.error('No working Supabase URL found. Reset password in Supabase dashboard and update backend/.env.supabase');
    process.exit(1);
}

main();
