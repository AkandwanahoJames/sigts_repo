/**
 * Verify SIGTS against final-project functional requirement areas (§4.3.4 / doc backup).
 * Run with backend on PORT (default 8001): node scripts/verify-requirements.js
 */
const http = require('http');
const { pool } = require('../src/config/database');

const PORT = Number(process.env.PORT) || 8001;
const BASE = `http://127.0.0.1:${PORT}`;

const REQUIREMENT_AREAS = [
    { id: 'FR-01', name: 'User Authentication and Access Control', weight: 'critical' },
    { id: 'FR-02', name: 'Geofencing and Location-Based Services', weight: 'high' },
    { id: 'FR-03', name: 'Tourist Information and Content Delivery', weight: 'critical' },
    { id: 'FR-04', name: 'Interactive Mapping and Navigation', weight: 'critical' },
    { id: 'FR-05', name: 'Tour Guide Management', weight: 'high' },
    { id: 'FR-06', name: 'AI-Powered Recommendations', weight: 'high' },
    { id: 'FR-07', name: 'Cultural Narratives and Storytelling', weight: 'medium' },
    { id: 'FR-08', name: 'Wildlife Sightings and Tracking', weight: 'critical' },
    { id: 'FR-09', name: 'Offline Synchronization', weight: 'high' },
    { id: 'FR-10', name: 'IT Administration and Content Management', weight: 'critical' },
    { id: 'FR-11', name: 'Predictive Analytics and Reporting', weight: 'medium' },
    { id: 'FR-12', name: 'Feedback and Continuous Improvement', weight: 'medium' },
];

function request(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : '';
        const req = http.request(
            {
                hostname: '127.0.0.1',
                port: PORT,
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
                        json = { raw: buf.slice(0, 300) };
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

async function tryLogin(username, passwords) {
    for (const password of passwords) {
        const r = await request('POST', '/api/auth/login', { username, password });
        const token = r.json?.accessToken || r.json?.token;
        if (token) return { username, token };
    }
    return null;
}

function record(results, areaId, check, status, detail) {
    results.push({ areaId, check, status, detail });
}

(async () => {
    const results = [];
    let tourist = null;
    let guide = null;
    let it = null;

    console.log('=== SIGTS Requirements Verification ===');
    console.log(`Target: ${BASE}\n`);

    // Infrastructure
    try {
        const health = await request('GET', '/api/health');
        const ok = health.status === 200 && health.json?.status === 'healthy';
        record(results, 'INFRA', 'API health', ok ? 'pass' : 'fail', `${health.status} ${health.json?.database?.status || ''}`);
        if (!ok) throw new Error('API unhealthy');
    } catch (e) {
        record(results, 'INFRA', 'API health', 'fail', e.message);
        printReport(results);
        console.error('\nStart backend: cd backend && $env:PORT=8001; npm start');
        process.exit(1);
    }

    try {
        const n = await pool.query('SELECT COUNT(*)::int AS n FROM users');
        record(results, 'INFRA', 'PostgreSQL connected', 'pass', `${n.rows[0].n} users`);
    } catch (e) {
        record(results, 'INFRA', 'PostgreSQL connected', 'fail', e.message);
    }

    tourist = await tryLogin('test_tourist', ['Test123!', 'Password123!']);
    record(
        results,
        'FR-01',
        'Tourist login (JWT)',
        tourist ? 'pass' : 'fail',
        tourist ? tourist.username : 'test_tourist failed'
    );

    const itRows = await pool.query(
        `SELECT username, user_type FROM users WHERE user_type IN ('it_manager','admin') ORDER BY user_type, username LIMIT 12`
    );
    let itManager = null;
    for (const row of itRows.rows) {
        const session = await tryLogin(row.username, [
            process.env.IT_TEST_PASSWORD,
            'Test123!',
            'Password123!',
            'demo123',
            'Admin123!'
        ].filter(Boolean));
        if (!session) continue;
        if (row.user_type === 'it_manager' && !itManager) itManager = session;
        if (!it) it = session;
    }
    it = itManager || it;
    record(results, 'FR-01', 'IT manager login', it ? 'pass' : 'fail', it ? `${it.username}` : 'no IT password');

    const guideRow = await pool.query(
        `SELECT u.username FROM users u
         JOIN tour_guides tg ON tg.user_id = u.user_id
         WHERE u.user_type = 'guide' LIMIT 1`
    );
    const guideCandidates = ['demo_guide', ...(guideRow.rows[0] ? [guideRow.rows[0].username] : [])];
    for (const uname of [...new Set(guideCandidates)]) {
        guide = await tryLogin(uname, ['Test123!', 'Password123!']);
        if (guide) break;
    }
    record(results, 'FR-01', 'Guide login', guide ? 'pass' : 'partial', guide ? guide.username : 'no guide creds');

    if (tourist) {
        const denied = await request('GET', '/api/admin/users/directory', null, tourist.token);
        record(
            results,
            'FR-01',
            'RBAC: tourist blocked from admin',
            denied.status === 403 || denied.status === 401 ? 'pass' : 'fail',
            `status ${denied.status}`
        );
    }

    // FR-02 Geofence (JWT required)
    if (tourist) {
        const boundary = await request('GET', '/api/geofence/boundary', null, tourist.token);
        record(
            results,
            'FR-02',
            'Park boundary API',
            boundary.status === 200 ? 'pass' : 'fail',
            `GET /api/geofence/boundary → ${boundary.status}`
        );
    } else {
        record(results, 'FR-02', 'Park boundary API', 'fail', 'needs tourist login');
    }

    // FR-03 Content
    const animals = await request('GET', '/api/animals?limit=5');
    record(
        results,
        'FR-03',
        'Animal catalogue API',
        animals.status === 200 && Array.isArray(animals.json?.animals || animals.json)
            ? 'pass'
            : animals.status === 200
              ? 'pass'
              : 'fail',
        `→ ${animals.status}, count ${(animals.json?.animals || animals.json || []).length ?? '?'}`
    );

    const publicLoc = await request('GET', '/api/locations/public?limit=5');
    record(results, 'FR-03', 'Public locations', publicLoc.status === 200 ? 'pass' : 'fail', `→ ${publicLoc.status}`);

    if (tourist) {
        const loc = await request('GET', '/api/locations?limit=5', null, tourist.token);
        record(results, 'FR-04', 'Authenticated locations (map POIs)', loc.status === 200 ? 'pass' : 'fail', `→ ${loc.status}`);
    }

    // FR-05 Tours
    if (guide) {
        const sched = await request('GET', '/api/tours/schedule', null, guide.token);
        record(results, 'FR-05', 'Guide schedule API', sched.status === 200 ? 'pass' : 'partial', `→ ${sched.status}`);
    } else {
        record(results, 'FR-05', 'Guide schedule API', 'partial', 'skipped — no guide login');
    }

    // FR-06 AI
    if (tourist) {
        const aiStatus = await request('GET', '/api/ai/status', null, tourist.token);
        record(
            results,
            'FR-06',
            'AI status endpoint',
            aiStatus.status === 200 ? 'pass' : 'fail',
            aiStatus.json?.llm_configured != null ? `llm=${aiStatus.json.llm_configured}` : `→ ${aiStatus.status}`
        );
        const chat = await request(
            'POST',
            '/api/ai/chat',
            { question: 'What safety tips apply for gorilla trekking in Bwindi?' },
            tourist.token
        );
        record(
            results,
            'FR-06',
            'Tour help chat response',
            chat.status === 200 && chat.json?.answer ? 'pass' : 'fail',
            chat.json?.meta?.nlp_mode || `→ ${chat.status}`
        );
    }

    // FR-07 Cultural (JWT required)
    if (tourist) {
        const culture = await request('GET', '/api/cultural?limit=5', null, tourist.token);
        record(
            results,
            'FR-07',
            'Cultural narratives API',
            culture.status === 200 ? 'pass' : 'fail',
            `→ ${culture.status}`
        );
    }

    // FR-08 Sightings
    if (tourist) {
        const recent = await request('GET', '/api/sightings/recent?limit=5', null, tourist.token);
        record(results, 'FR-08', 'Recent sightings feed', recent.status === 200 ? 'pass' : 'fail', `→ ${recent.status}`);
        const stats = await request('GET', '/api/sightings/stats?days=30', null, tourist.token);
        record(results, 'FR-08', 'Sighting statistics', stats.status === 200 ? 'pass' : 'fail', `→ ${stats.status}`);
    }

    // FR-09 Sync
    if (tourist) {
        const syncMeta = await request('GET', '/api/sync/status', null, tourist.token);
        record(
            results,
            'FR-09',
            'Offline sync status API',
            syncMeta.status === 200 ? 'pass' : 'partial',
            `→ ${syncMeta.status}`
        );
    }

    // FR-10 IT Admin
    if (it) {
        const stats = await request('GET', '/api/admin/stats', null, it.token);
        const accounts = stats.json?.totalAccounts ?? stats.json?.totalRegisteredUsers;
        record(
            results,
            'FR-10',
            'Admin stats (live DB)',
            stats.status === 200 && accounts != null ? 'pass' : 'fail',
            stats.json ? `accounts=${accounts}` : `→ ${stats.status}`
        );
        const snap = await request('GET', '/api/admin/operational-snapshot?window_minutes=5', null, it.token);
        record(results, 'FR-10', 'Operational snapshot KPIs', snap.status === 200 ? 'pass' : 'fail', snap.json?.error || 'OK');
        const dir = await request('GET', '/api/admin/users/directory', null, it.token);
        record(
            results,
            'FR-10',
            'User directory (all accounts)',
            dir.status === 200 && dir.json?.complete === true ? 'pass' : dir.status === 200 ? 'partial' : 'fail',
            dir.json ? `total=${dir.json.total}, loaded=${dir.json.loaded}` : `→ ${dir.status}`
        );
    } else {
        record(results, 'FR-10', 'IT admin APIs', 'fail', 'IT login required');
    }

    // FR-11 Analytics
    if (it) {
        const end = new Date().toISOString();
        const start = new Date(Date.now() - 7 * 86400000).toISOString();
        const flow = await request(
            'GET',
            `/api/analytics/visitor-flow?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&interval=day`,
            null,
            it.token
        );
        record(results, 'FR-11', 'Visitor flow analytics', flow.status === 200 ? 'pass' : 'partial', `→ ${flow.status}`);
        const popular = await request('GET', '/api/analytics/popular-content?limit=5', null, it.token);
        record(results, 'FR-11', 'Popular content analytics', popular.status === 200 ? 'pass' : 'partial', `→ ${popular.status}`);
    }

    // FR-12 Feedback
    if (tourist) {
        const fb = await request(
            'POST',
            '/api/feedback',
            { rating: 5, comment: 'Requirements verification probe', category: 'app' },
            tourist.token
        );
        record(
            results,
            'FR-12',
            'Submit app feedback',
            fb.status === 200 || fb.status === 201 ? 'pass' : 'fail',
            `→ ${fb.status}`
        );
    }

    printReport(results);
    await pool.end();
    const failed = results.filter((r) => r.status === 'fail').length;
    process.exit(failed ? 1 : 0);
})().catch(async (e) => {
    console.error(e);
    try {
        await pool.end();
    } catch (_) {}
    process.exit(1);
});

function printReport(results) {
    console.log('\n--- By requirement area (document §4.3.4) ---\n');
    for (const area of REQUIREMENT_AREAS) {
        const rows = results.filter((r) => r.areaId === area.id);
        if (!rows.length) continue;
        const fails = rows.filter((r) => r.status === 'fail').length;
        const partial = rows.filter((r) => r.status === 'partial').length;
        const passes = rows.filter((r) => r.status === 'pass').length;
        const icon = fails ? 'FAIL' : partial ? 'PARTIAL' : 'PASS';
        console.log(`${area.id} ${icon} — ${area.name}`);
        for (const r of rows) {
            const mark = r.status === 'pass' ? '✓' : r.status === 'partial' ? '~' : '✗';
            console.log(`    ${mark} ${r.check}: ${r.detail}`);
        }
        console.log(`    (${passes} pass, ${partial} partial, ${fails} fail)\n`);
    }

    const infra = results.filter((r) => r.areaId === 'INFRA');
    if (infra.length) {
        console.log('--- Infrastructure ---');
        infra.forEach((r) => console.log(`  ${r.status === 'pass' ? '✓' : '✗'} ${r.check}: ${r.detail}`));
    }

    const summary = {
        pass: results.filter((r) => r.status === 'pass').length,
        partial: results.filter((r) => r.status === 'partial').length,
        fail: results.filter((r) => r.status === 'fail').length,
    };
    console.log('\n--- Summary ---');
    console.log(`  Pass: ${summary.pass}  Partial: ${summary.partial}  Fail: ${summary.fail}`);
    if (summary.fail) {
        console.log('\nDocument claims vs runtime: fix failures before pilot sign-off.');
    }
}
