const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

let loaded = false;

function loadEnv() {
    if (loaded) return;

    const backendEnvPath = path.resolve(__dirname, '../../.env');
    const rootEnvPath = path.resolve(__dirname, '../../../.env');

    // Prefer backend/.env when running backend scripts directly,
    // but also support monorepo root .env as fallback.
    const candidates = [backendEnvPath, rootEnvPath];
    for (const envPath of candidates) {
        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath });
            loaded = true;
            return;
        }
    }

    // Final fallback to default dotenv lookup behavior.
    dotenv.config();
    loaded = true;
}

module.exports = { loadEnv };
