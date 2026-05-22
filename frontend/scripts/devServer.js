/**
 * Dev static server for frontend/public with /api proxy.
 * Does NOT SPA-fallback missing .js/.css (live-server --spa breaks script loading).
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

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

const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json'
};

const SPA_HTML_PATHS = new Set(['/reset-password', '/verify-email']);

function contentTypeFor(filePath) {
    return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function safePublicPath(publicDir, urlPathname) {
    const rel = decodeURIComponent(urlPathname).replace(/^\/+/, '') || 'index.html';
    const filePath = path.normalize(path.join(publicDir, rel));
    if (!filePath.startsWith(publicDir)) return null;
    return filePath;
}

function proxyApi(req, res, apiOrigin) {
    const incoming = new URL(req.url || '/', 'http://localhost');
    const targetBase = new URL(apiOrigin.endsWith('/api') ? apiOrigin : `${apiOrigin}/api`);
    const targetPath = `${targetBase.pathname.replace(/\/$/, '')}${incoming.pathname.replace(/^\/api/, '')}${incoming.search}`;

    const headers = { ...req.headers, host: targetBase.host };
    delete headers.connection;

    const proxyReq = http.request(
        {
            protocol: targetBase.protocol,
            hostname: targetBase.hostname,
            port: targetBase.port || (targetBase.protocol === 'https:' ? 443 : 80),
            method: req.method,
            path: targetPath,
            headers
        },
        (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
            proxyRes.pipe(res);
        }
    );

    proxyReq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'API proxy failed', message: err.message }));
    });

    req.pipe(proxyReq);
}

function startServer() {
    const frontendRoot = path.resolve(__dirname, '..');
    const repoRoot = path.resolve(frontendRoot, '..');
    const publicDir = path.join(frontendRoot, 'public');
    const env = {
        ...parseEnvFile(path.join(repoRoot, '.env')),
        ...parseEnvFile(path.join(repoRoot, 'backend', '.env')),
        ...parseEnvFile(path.join(frontendRoot, '.env')),
        ...process.env
    };

    const apiPort = Number.parseInt(env.API_PORT || env.PORT || '', 10) || 8000;
    const listenPort = Number.parseInt(env.FRONTEND_PORT || '', 10) || 3000;
    const apiOrigin = `http://127.0.0.1:${apiPort}`;

    require('child_process').execSync('node scripts/generateRuntimeConfig.js', {
        cwd: frontendRoot,
        stdio: 'inherit'
    });

    const server = http.createServer((req, res) => {
        const url = new URL(req.url || '/', `http://127.0.0.1:${listenPort}`);

        if (url.pathname.startsWith('/api')) {
            return proxyApi(req, res, apiOrigin);
        }

        let filePath = safePublicPath(publicDir, url.pathname === '/' ? '/index.html' : url.pathname);

        if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            res.writeHead(200, {
                'Content-Type': contentTypeFor(filePath),
                'Cache-Control': 'no-cache'
            });
            fs.createReadStream(filePath).pipe(res);
            return;
        }

        const hasExtension = /\.[a-z0-9]{1,12}$/i.test(url.pathname);
        if (hasExtension) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not found');
            return;
        }

        const cleanPath = url.pathname.replace(/\/+$/, '') || '/';
        if (SPA_HTML_PATHS.has(cleanPath) || cleanPath === '/') {
            const indexPath = path.join(publicDir, 'index.html');
            if (fs.existsSync(indexPath)) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
                fs.createReadStream(indexPath).pipe(res);
                return;
            }
        }

        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
    });

    server.listen(listenPort, '0.0.0.0', () => {
        console.log(`SIGTS frontend: http://localhost:${listenPort}`);
        console.log(`SIGTS API (proxied): http://127.0.0.1:${apiPort}/api`);
    });
}

startServer();
