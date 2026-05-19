/**
 * Base URL for browser-facing app pages (reset password, verify email).
 * Deep routes like /reset-password must be served by the SPA host.
 */
function resolvePublicAppBaseUrl() {
    if (process.env.PUBLIC_APP_URL) {
        return process.env.PUBLIC_APP_URL.split(',')[0].trim().replace(/\/$/, '');
    }

    const port = Number(process.env.PORT) || 8000;
    const clientUrls = (process.env.CLIENT_URL || '')
        .split(',')
        .map((s) => s.trim().replace(/\/$/, ''))
        .filter(Boolean);

    const client = clientUrls[0] || '';

    // Dev: frontend on :3000 often lacks SPA fallback; backend on PORT serves the app reliably.
    if (process.env.NODE_ENV !== 'production' && client.includes(':3000')) {
        return `http://localhost:${port}`;
    }

    return client || `http://localhost:${port}`;
}

module.exports = { resolvePublicAppBaseUrl };
