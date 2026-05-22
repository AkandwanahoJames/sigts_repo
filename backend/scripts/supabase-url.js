#!/usr/bin/env node
/**
 * Print DATABASE_URL for Supabase from project ref + DB_PASSWORD in backend/.env
 * Usage: node scripts/supabase-url.js <project-ref>
 *    or: node scripts/supabase-url.js https://abcdefgh.supabase.co
 */

const { loadEnv } = require('../src/config/env');
const { resolveDatabaseUrl } = require('../src/config/pgPoolConfig');

loadEnv();

const arg = (process.argv[2] || '').trim();
if (!arg) {
    console.error('Usage: node scripts/supabase-url.js <project-ref-or-supabase-url>');
    process.exit(1);
}

if (arg.includes('supabase.co')) {
    process.env.SUPABASE_URL = arg.startsWith('http') ? arg : `https://${arg}`;
} else {
    process.env.SUPABASE_URL = `https://${arg}.supabase.co`;
}

const url = resolveDatabaseUrl();
if (!url) {
    console.error('Set DB_PASSWORD (or SUPABASE_DB_PASSWORD) in backend/.env first.');
    process.exit(1);
}

console.log(url);
