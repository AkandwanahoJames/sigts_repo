/**
 * SIGTS system debug — API, DB, auth, IT admin directory.
 * Run: node scripts/debug-system.js
 */
const http = require('http');
const { pool } = require('../src/config/database');

function request(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : '';
        const req = http.request(
            {
                hostname: '127.0.0.1',
                port: Number(process.env.PORT) || 8001,
                path: path.startsWith('/') ? path : `/${path}`,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
                }
            },
            (res) => {
                let buf = '';
                res.on('data', (c) => (buf += c));
                res.on('end', () => {
                    let json = null;
                    try {
                        json = buf ? JSON.parse(buf) : null;
                    } catch {
                        json = { raw: buf.slice(0, 200) };
                    }
                    resolve({ status: res.statusCode, json });
                });
            }
        );
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

const issues = [];
const ok = [];

async function tryLogin(username, passwords) {
    for (const password of passwords) {
        const r = await request('POST', '/api/auth/login', { username, password });
        const token = r.json?.accessToken || r.json?.token;
        if (token) return { username, password, token, status: r.status };
    }
    return null;
}

(async () => {
    console.log('=== SIGTS System Debug ===\n');

    try {
        const health = await request('GET', '/api/health');
        if (health.status === 200 && health.json?.status === 'healthy') {
            ok.push(`API health OK (${health.json.database?.status}, ${health.json.database?.latency_ms}ms)`);
        } else {
            issues.push(`Health check failed: ${health.status} ${JSON.stringify(health.json)}`);
        }
    } catch (e) {
        issues.push(`API not reachable on port ${process.env.PORT || 8001}: ${e.message}`);
        console.log('Issues:', issues);
        process.exit(1);
    }

    try {
        const users = await pool.query('SELECT COUNT(*)::int AS n FROM users');
        const byType = await pool.query(
            `SELECT user_type, COUNT(*)::int AS c FROM users GROUP BY user_type ORDER BY c DESC`
        );
        ok.push(`Database: ${users.rows[0].n} users (${byType.rows.map((r) => `${r.user_type}:${r.c}`).join(', ')})`);
    } catch (e) {
        issues.push(`Database query failed: ${e.message}`);
    }

    try {
        await pool.query('SELECT last_location_time FROM users LIMIT 1');
        ok.push('Column last_location_time exists');
    } catch (e) {
        if (e.message?.includes('last_location_time')) {
            issues.push('Missing migration: users.last_location_time — run npm run migrate in backend');
        } else {
            issues.push(`DB schema check: ${e.message}`);
        }
    }

    const publicPaths = ['/api/animals?limit=3', '/api/health', '/api/locations/public'];
    for (const p of publicPaths) {
        try {
            const r = await request('GET', p);
            if (r.status >= 200 && r.status < 300) ok.push(`GET ${p} → ${r.status}`);
            else issues.push(`GET ${p} → ${r.status} ${r.json?.error || ''}`);
        } catch (e) {
            issues.push(`GET ${p} failed: ${e.message}`);
        }
    }

    const login = await tryLogin('test_tourist', ['Test123!', 'Password123!']);
    if (login) {
        const locAuth = await request('GET', '/api/locations?limit=3', null, login.token);
        if (locAuth.status === 200) ok.push('GET /api/locations (authenticated) → 200');
        else issues.push(`GET /api/locations (auth): ${locAuth.status}`);
    }
    if (login) {
        ok.push(`Tourist login OK (${login.username})`);
        const sighting = await request('GET', '/api/sightings/stats?days=30', null, login.token);
        if (sighting.status === 200) ok.push('Sightings stats OK');
        else issues.push(`Sightings stats: ${sighting.status}`);
    } else {
        issues.push('Tourist login failed (test_tourist / Test123!) — run npm run seed or set-password');
    }

    const itUsers = await pool.query(
        `SELECT username FROM users WHERE user_type IN ('it_manager','admin') ORDER BY username LIMIT 5`
    );
    let itLogin = null;
    for (const row of itUsers.rows) {
        itLogin = await tryLogin(row.username, [
            process.env.IT_TEST_PASSWORD,
            'Test123!',
            'Password123!',
            'demo123',
            'Admin123!'
        ].filter(Boolean));
        if (itLogin) break;
    }

    if (itLogin) {
        ok.push(`IT login OK (${itLogin.username})`);
        const dir = await request('GET', '/api/admin/users/directory', null, itLogin.token);
        if (dir.status === 200 && dir.json?.total != null) {
            ok.push(
                `Admin directory: total=${dir.json.total}, loaded=${dir.json.loaded}, complete=${dir.json.complete}`
            );
        } else {
            issues.push(`Admin directory failed: ${dir.status} ${JSON.stringify(dir.json)?.slice(0, 120)}`);
        }
        const snap = await request('GET', '/api/admin/operational-snapshot?window_minutes=5', null, itLogin.token);
        if (snap.status === 200) ok.push('Operational snapshot OK');
        else issues.push(`Operational snapshot: ${snap.status} ${snap.json?.error || ''}`);
        const active = await request('GET', '/api/admin/active-users?window_minutes=5', null, itLogin.token);
        if (active.status === 200) ok.push(`Active users: ${active.json?.count ?? 0}`);
        else issues.push(`Active users endpoint: ${active.status} ${active.json?.error || ''}`);
    } else {
        issues.push(
            `IT/admin login failed for: ${itUsers.rows.map((r) => r.username).join(', ') || 'none'}. ` +
                'Use: npm run set-password -- <username> <password>'
        );
    }

    if (login) {
        const dirDenied = await request('GET', '/api/admin/users/directory', null, login.token);
        if (dirDenied.status === 403 || dirDenied.status === 401) {
            ok.push('Admin directory correctly blocked for tourist');
        } else {
            issues.push(`Admin directory should deny tourist but returned ${dirDenied.status}`);
        }
    }

    console.log('\n--- OK ---');
    ok.forEach((m) => console.log('  ✓', m));
    console.log('\n--- Issues ---');
    if (issues.length) issues.forEach((m) => console.log('  ✗', m));
    else console.log('  (none)');

    console.log('\n--- Quick fixes ---');
    if (issues.some((i) => i.includes('not reachable'))) {
        console.log('  • Start backend: cd backend && $env:PORT=8001; npm start');
    }
    if (issues.some((i) => i.includes('last_location_time'))) {
        console.log('  • cd backend && npm run migrate');
    }
    if (issues.some((i) => i.includes('login failed'))) {
        console.log('  • cd backend && npm run set-password -- demo_it YourPassword');
    }
    console.log('  • Frontend: cd frontend && npm run dev  (port 3000 → API 8001 per runtime-config.js)');
    console.log('  • Hard refresh browser after JS changes\n');

    await pool.end();
    process.exit(issues.length ? 1 : 0);
})().catch(async (e) => {
    console.error(e);
    try {
        await pool.end();
    } catch (_) {}
    process.exit(1);
});
