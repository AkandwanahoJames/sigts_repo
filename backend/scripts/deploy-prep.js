/**
 * Prepare a hosted database (Supabase) for SIGTS: verify env, run migrations, optional seed.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/deploy-prep.js
 *   DATABASE_URL=postgresql://... node scripts/deploy-prep.js --seed
 *   DATABASE_URL=postgresql://... node scripts/deploy-prep.js --seed-interactive
 */

const { spawnSync } = require('child_process');
const path = require('path');
const { loadEnv } = require('../src/config/env');
const { validateDatabaseEnv } = require('../src/config/pgPoolConfig');

loadEnv();

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function hasDatabaseConfig() {
    return Boolean(
        process.env.DATABASE_URL
        || (process.env.DB_HOST && process.env.DB_PASSWORD)
    );
}

function runNodeScript(scriptName, extraArgs = []) {
    const scriptPath = path.join(__dirname, scriptName);
    const result = spawnSync(process.execPath, [scriptPath, ...extraArgs], {
        stdio: 'inherit',
        env: process.env,
        cwd: path.join(__dirname, '..'),
    });
    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

function main() {
    const args = process.argv.slice(2);
    const wantSeed = args.includes('--seed');
    const wantInteractive = args.includes('--seed-interactive');

    log('\nSIGTS deploy prep (hosted Postgres)', 'blue');

    if (!hasDatabaseConfig()) {
        log('Missing DATABASE_URL or DB_HOST + DB_PASSWORD.', 'red');
        log('Set credentials in backend/.env or your shell, then retry.', 'yellow');
        process.exit(1);
    }

    try {
        process.env.NODE_ENV = process.env.NODE_ENV || 'production';
        validateDatabaseEnv();
    } catch (err) {
        log(err.message, 'red');
        process.exit(1);
    }

    if (process.env.DATABASE_URL?.includes('supabase') || process.env.DB_HOST?.includes('supabase')) {
        log('Supabase detected — run migrations only (no local init-db).', 'yellow');
    }

    log('\n1/2 Running migrations...', 'blue');
    runNodeScript('migrate.js', ['up']);

    if (wantInteractive) {
        log('\n2/2 Seeding interactive demo data...', 'blue');
        runNodeScript('seedInteractiveData.js');
    } else if (wantSeed) {
        log('\n2/2 Seeding base data...', 'blue');
        runNodeScript('seed.js');
    } else {
        log('\n2/2 Skipping seed (pass --seed or --seed-interactive to populate).', 'yellow');
    }

    log('\nDeploy prep complete. Next:', 'green');
    log('  • Render: set DATABASE_URL, JWT_SECRET, CLIENT_URL, PUBLIC_APP_URL', 'green');
    log('  • Vercel: set API_URL=https://<render-host>/api and run build:frontend', 'green');
    log('  • Verify: npm run health --workspace=backend', 'green');
}

main();
