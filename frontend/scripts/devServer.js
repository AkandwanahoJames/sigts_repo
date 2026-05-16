/**
 * Start live-server with /api proxied to the backend (same-origin registration from :3000).
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const values = {};
    for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        values[trimmed.slice(0, eq).trim()] = value;
    }
    return values;
}

const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');
const env = {
    ...parseEnvFile(path.join(repoRoot, '.env')),
    ...parseEnvFile(path.join(repoRoot, 'backend', '.env')),
    ...parseEnvFile(path.join(frontendRoot, '.env'))
};

const apiPort = Number.parseInt(env.API_PORT || env.PORT || '', 10) || 8000;
const proxyTarget = `http://127.0.0.1:${apiPort}`;

require('child_process').execSync('node scripts/generateRuntimeConfig.js', { cwd: frontendRoot, stdio: 'inherit' });

console.log(`SIGTS frontend: http://localhost:3000  (API → ${proxyTarget}/api)`);

const child = spawn(
    'npx',
    ['live-server', 'public', '--host=0.0.0.0', '--port=3000', '--no-browser', `--proxy=/api:${proxyTarget}`],
    { cwd: frontendRoot, stdio: 'inherit', shell: true }
);

child.on('exit', (code) => process.exit(code || 0));
