/**
 * Generates low-fidelity SIGTS wireframe SVGs for project report.
 * Run: node wireframes/generate-wireframes.js
 */
const fs = require('fs');
const path = require('path');

const OUT = __dirname;
const STROKE = '#2d2d2d';
const MUTED = '#6b6b6b';
const FILL = '#e8e8e8';
const FILL_DARK = '#d0d0d0';
const WHITE = '#ffffff';
const ACCENT = '#419310';

function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function rect(x, y, w, h, opts = {}) {
    const { fill = FILL, stroke = STROKE, rx = 4, dash } = opts;
    const dashAttr = dash ? ` stroke-dasharray="${dash}"` : '';
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"${dashAttr}/>`;
}

function text(x, y, content, opts = {}) {
    const { size = 12, weight = 'normal', fill = STROKE, anchor = 'start' } = opts;
    return `<text x="${x}" y="${y}" fill="${fill}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${esc(content)}</text>`;
}

function label(x, y, w, h, title, sub = '') {
    let s = rect(x, y, w, h, { fill: WHITE });
    s += text(x + 8, y + 18, title, { size: 11, weight: 'bold' });
    if (sub) s += text(x + 8, y + 34, sub, { size: 9, fill: MUTED });
    return s;
}

function imgPlaceholder(x, y, w, h, caption = 'Image') {
    let s = rect(x, y, w, h, { fill: FILL_DARK, dash: '6 4' });
    s += text(x + w / 2, y + h / 2 + 4, caption, { size: 10, fill: MUTED, anchor: 'middle' });
    return s;
}

function btn(x, y, w, h, t, primary = false) {
    const fill = primary ? ACCENT : WHITE;
    const color = primary ? WHITE : STROKE;
    let s = rect(x, y, w, h, { fill, rx: 6 });
    s += text(x + w / 2, y + h / 2 + 5, t, { size: 11, weight: 'bold', fill: color, anchor: 'middle' });
    return s;
}

function header(title, w) {
    return `${text(24, 32, title, { size: 18, weight: 'bold' })}
${text(24, 52, 'SIGTS — Smart Information Guide Tour System · Bwindi Impenetrable National Park', { size: 10, fill: MUTED })}
${rect(24, 64, w - 48, 1, { fill: STROKE, stroke: 'none' })}`;
}

function wrapSvg(w, h, body, title) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}">
  <title>${esc(title)}</title>
  <rect width="100%" height="100%" fill="#fafafa"/>
  ${body}
</svg>`;
}

/** Reference-style full report page — desktop */
function overviewDesktop() {
    const W = 1200;
    const H = 3400;
    let y = 80;
    let b = header('Figure 1 — SIGTS visitor experience (desktop wireframe)', W);

    // Hero
    b += text(24, y, '1. Landing / Dashboard hero', { size: 13, weight: 'bold' });
    y += 20;
    b += rect(24, y, W - 48, 220, { fill: WHITE });
    b += text(48, y + 40, 'Explore Bwindi With Confidence.', { size: 22, weight: 'bold' });
    b += text(48, y + 68, 'Park-aware maps, species catalogue, culture stories, and Tour help chat.', { size: 12, fill: MUTED });
    b += btn(48, y + 100, 140, 36, 'Browse species', true);
    b += btn(200, y + 100, 120, 36, 'Tour help', false);
    b += imgPlaceholder(620, y + 24, 540, 172, 'Park / gorilla hero');
    y += 240;

    // Feature bar
    b += text(24, y, '2. Park access & capability strip', { size: 13, weight: 'bold' });
    y += 20;
    const fw = (W - 48 - 32) / 3;
    ['Geofence status', 'Offline sync', 'Species heatmap'].forEach((t, i) => {
        const x = 24 + i * (fw + 16);
        b += rect(x, y, fw, 72, { fill: WHITE });
        b += rect(x + 16, y + 16, 40, 40, { fill: FILL, rx: 20 });
        b += text(x + 68, y + 32, t, { size: 11, weight: 'bold' });
        b += text(x + 68, y + 50, 'Status chip + short label', { size: 9, fill: MUTED });
    });
    y += 92;

    // Animals grid
    b += text(24, y, '3. Biodiversity catalogue (Animals tab)', { size: 13, weight: 'bold' });
    y += 20;
    b += rect(24, y, 200, 28, { fill: FILL_DARK, rx: 14 });
    b += text(44, y + 19, 'Primates | Birds | Mammals', { size: 10 });
    b += text(W - 120, y + 19, '← →', { size: 14, anchor: 'middle' });
    y += 40;
    const cw = (W - 48 - 32) / 3;
    for (let i = 0; i < 3; i++) {
        const x = 24 + i * (cw + 16);
        b += rect(x, y, cw, 200, { fill: WHITE });
        b += imgPlaceholder(x + 12, y + 12, cw - 24, 100, 'Species photo');
        b += text(x + 12, y + 128, 'Mountain Gorilla', { size: 11, weight: 'bold' });
        b += text(x + 12, y + 146, 'Endangered · Buhoma sector', { size: 9, fill: MUTED });
        b += text(x + 12, y + 168, '$ Permit info', { size: 10, fill: MUTED });
        b += btn(x + cw - 72, y + 160, 60, 24, 'View', false);
    }
    y += 220;

    // User guide
    b += text(24, y, '4. First-time user guide', { size: 13, weight: 'bold' });
    y += 20;
    b += rect(24, y, W - 48, 200, { fill: WHITE });
    b += text(48, y + 36, 'User guide for first-time visitors', { size: 18, weight: 'bold' });
    const steps = [
        'Register — Create account with email, phone, and role.',
        'Enable location — Allow geofence check for park access.',
        'Browse offline — Cache map tiles and species packs.',
        'Ask Tour help — Chat with grounded Bwindi assistant.'
    ];
    steps.forEach((s, i) => {
        b += text(400, y + 40 + i * 40, `Step ${i + 1}`, { size: 10, weight: 'bold', fill: ACCENT });
        b += text(460, y + 40 + i * 40, s, { size: 11 });
    });
    y += 220;

    // Testimonials
    b += text(24, y, '5. Visitor feedback', { size: 13, weight: 'bold' });
    y += 20;
    b += rect(24, y, W - 48, 180, { fill: WHITE });
    b += text(W / 2, y + 24, 'Satisfied visitors speak', { size: 16, weight: 'bold', anchor: 'middle' });
    b += imgPlaceholder(48, y + 48, 160, 100, 'Avatar');
    b += rect(240, y + 48, W - 320, 100, { fill: FILL });
    b += text(260, y + 80, '"SIGTS helped our group plan the trek and find species on the trail."', { size: 11 });
    b += text(260, y + 110, '★★★★★  Visitor · Tourist role', { size: 10, fill: MUTED });
    b += btn(W / 2 - 60, y + 148, 120, 28, 'See more', true);
    y += 200;

    // Stats
    b += text(24, y, '6. Park statistics & information', { size: 13, weight: 'bold' });
    y += 20;
    b += rect(24, y, W - 48, 200, { fill: WHITE });
    b += text(48, y + 48, '331+ km²', { size: 20, weight: 'bold' });
    b += text(48, y + 72, 'Forest reserve', { size: 10, fill: MUTED });
    b += text(200, y + 48, '400+', { size: 20, weight: 'bold' });
    b += text(200, y + 72, 'Species records', { size: 10, fill: MUTED });
    b += text(340, y + 48, 'Live', { size: 20, weight: 'bold' });
    b += text(340, y + 72, 'Active sessions', { size: 10, fill: MUTED });
    b += imgPlaceholder(520, y + 24, 200, 152, 'Park map');
    b += text(740, y + 48, 'Bwindi Impenetrable National Park', { size: 14, weight: 'bold' });
    b += text(740, y + 72, 'Body copy: conservation, trekking sectors, UWA coordination.', { size: 10, fill: MUTED });
    y += 220;

    // Info / seasonal
    b += text(24, y, '7. Seasonal updates (Info)', { size: 13, weight: 'bold' });
    y += 20;
    const bw = (W - 48 - 48) / 4;
    for (let i = 0; i < 4; i++) {
        const x = 24 + i * (bw + 16);
        b += rect(x, y, bw, 140, { fill: WHITE });
        b += imgPlaceholder(x + 8, y + 8, bw - 16, 70, 'Thumb');
        b += text(x + 8, y + 92, 'Seasonal tip ' + (i + 1), { size: 10, weight: 'bold' });
        b += text(x + 8, y + 108, 'Date · Ranger note', { size: 8, fill: MUTED });
    }
    y += 160;

    // Services / roles
    b += text(24, y, '8. Role-based services', { size: 13, weight: 'bold' });
    y += 20;
    const roles = [
        ['01', 'Tourist', 'Dashboard, species, map, culture, Tour help'],
        ['02', 'Tour guide', 'Schedules, guest lists, sightings, clock in/out'],
        ['03', 'IT manager', 'Active users, analytics, tour assignments']
    ];
    const rw = (W - 48 - 32) / 3;
    roles.forEach(([num, title, desc], i) => {
        const x = 24 + i * (rw + 16);
        const dark = i === 0;
        b += rect(x, y, rw, 160, { fill: dark ? '#2d2d2d' : WHITE });
        b += text(x + 16, y + 36, num, { size: 28, weight: 'bold', fill: dark ? WHITE : STROKE });
        b += text(x + 16, y + 72, title, { size: 14, weight: 'bold', fill: dark ? WHITE : STROKE });
        b += text(x + 16, y + 96, desc, { size: 9, fill: dark ? '#ccc' : MUTED });
    });
    y += 180;

    b += text(24, y, 'Low-fidelity wireframe — not final UI. Generated for SIGTS final project report.', { size: 9, fill: MUTED });

    return wrapSvg(W, H, b, 'SIGTS system overview desktop wireframe');
}

function overviewMobile() {
    const W = 390;
    let y = 72;
    let b = header('Figure 2 — SIGTS visitor experience (mobile wireframe)', W);

    const addSection = (title, height, inner) => {
        b += text(16, y, title, { size: 11, weight: 'bold' });
        y += 16;
        b += rect(16, y, W - 32, height, { fill: WHITE });
        b += inner(24, y + 8, W - 48);
        y += height + 20;
    };

    addSection('1. Hero', 200, (x, sy, w) => {
        let s = text(x, sy + 20, 'Explore Bwindi With Confidence.', { size: 16, weight: 'bold' });
        s += text(x, sy + 42, 'Maps · Species · Culture · Tour help', { size: 9, fill: MUTED });
        s += btn(x, sy + 58, w - 20, 32, 'Browse species', true);
        s += imgPlaceholder(x, sy + 100, w, 80, 'Hero image');
        return s;
    });

    addSection('2. Quick actions', 88, (x, sy, w) => {
        let s = '';
        ['Geofence', 'Offline', 'Heatmap'].forEach((t, i) => {
            s += rect(x + i * (w / 3 + 4), sy + 8, w / 3 - 4, 64, { fill: FILL });
            s += text(x + i * (w / 3 + 4) + 8, sy + 40, t, { size: 8, weight: 'bold' });
        });
        return s;
    });

    addSection('3. Species card', 180, (x, sy, w) => {
        let s = imgPlaceholder(x, sy + 8, w, 90, 'Photo');
        s += text(x, sy + 108, 'Mountain Gorilla', { size: 11, weight: 'bold' });
        s += btn(x, sy + 140, 56, 24, 'View', false);
        return s;
    });

    addSection('4. User guide', 160, (x, sy, w) => {
        let s = text(x, sy + 16, 'First-time guide', { size: 12, weight: 'bold' });
        for (let i = 0; i < 4; i++) {
            s += text(x, sy + 40 + i * 28, `${i + 1}. Step — short description`, { size: 9 });
        }
        return s;
    });

    addSection('5. Feedback', 120, (x, sy, w) => {
        let s = text(x + w / 2, sy + 20, 'Visitor quote', { size: 10, anchor: 'middle' });
        s += rect(x, sy + 36, w, 48, { fill: FILL });
        return s;
    });

    addSection('6. Mobile tab bar', 56, (x, sy, w) => {
        let s = rect(x, sy + 8, w, 40, { fill: FILL_DARK });
        ['Home', 'Species', 'Map', 'Saved', 'You'].forEach((t, i) => {
            s += text(x + (w / 5) * i + w / 10, sy + 32, t, { size: 7, anchor: 'middle' });
        });
        return s;
    });

    const H = y + 40;
    return wrapSvg(W, H, b, 'SIGTS system overview mobile wireframe');
}

function appShellDesktop(screenTitle, slotContent) {
    const W = 1200;
    const H = 800;
    let b = header(screenTitle, W);
    b += rect(24, 72, 200, H - 120, { fill: WHITE });
    b += text(36, 100, 'SIGTS', { size: 14, weight: 'bold' });
    const nav = ['Home', 'Animals', 'Map', 'Culture', 'Chat', 'Sightings', 'Saved', 'Profile'];
    nav.forEach((n, i) => {
        b += text(36, 130 + i * 28, n, { size: 10, fill: i === 0 ? ACCENT : MUTED });
    });
    b += text(36, H - 100, 'Logout', { size: 10, fill: MUTED });
    b += rect(240, 72, W - 264, 48, { fill: WHITE });
    b += text(256, 102, '☰  Page title', { size: 12, weight: 'bold' });
    b += text(W - 200, 102, 'Online · Profile', { size: 9, fill: MUTED, anchor: 'end' });
    b += rect(240, 132, W - 264, H - 180, { fill: WHITE });
    b += slotContent(256, 148, W - 288);
    return wrapSvg(W, H, b, screenTitle);
}

function authWireframe(mobile) {
    const W = mobile ? 390 : 1200;
    const H = mobile ? 700 : 640;
    let b = header(mobile ? 'Auth — Log in / Register (mobile)' : 'Auth — Log in / Register (desktop)', W);
    if (mobile) {
        b += rect(16, 72, W - 32, 120, { fill: FILL_DARK });
        b += text(W / 2, 130, 'Welcome panel', { size: 11, anchor: 'middle', fill: MUTED });
        b += rect(16, 200, W - 32, 460, { fill: WHITE });
        b += text(32, 240, 'Log In | Create Account', { size: 11, weight: 'bold' });
        b += label(32, 270, W - 64, 40, 'Email, username, or name');
        b += label(32, 320, W - 64, 40, 'Password');
        b += btn(32, 380, W - 64, 40, 'Sign In', true);
        b += text(W / 2, 440, 'Forgot password?', { size: 9, fill: ACCENT, anchor: 'middle' });
    } else {
        b += rect(24, 72, 420, H - 120, { fill: FILL_DARK });
        b += text(48, 200, 'Bwindi SIGTS', { size: 20, weight: 'bold', fill: WHITE });
        b += text(48, 230, 'Welcome copy', { size: 11, fill: '#ccc' });
        b += rect(460, 72, W - 484, H - 120, { fill: WHITE });
        b += text(500, 120, 'Log In | Create Account tabs', { size: 12, weight: 'bold' });
        b += label(500, 160, 400, 44, 'Email, username, or name', 'input field');
        b += label(500, 220, 400, 44, 'Password', 'input field');
        b += label(500, 280, 200, 24, 'Remember me', 'checkbox');
        b += btn(500, 330, 160, 40, 'Sign In', true);
        b += text(500, 390, 'Forgot password?', { size: 10, fill: ACCENT });
    }
    return wrapSvg(W, H, b, 'SIGTS auth wireframe');
}

function dashboardSlot(x, y, w) {
    let s = text(x, y, 'Park access panel', { size: 10, weight: 'bold' });
    s += rect(x, y + 16, w, 56, { fill: FILL });
    y += 88;
    s += text(x, y, 'Quick grid (4 tiles)', { size: 10, weight: 'bold' });
    const tw = (w - 24) / 4;
    for (let i = 0; i < 4; i++) {
        s += rect(x + i * (tw + 8), y + 16, tw, 80, { fill: FILL });
        s += text(x + i * (tw + 8) + tw / 2, y + 58, ['Animals', 'Map', 'Culture', 'Info'][i], {
            size: 8,
            anchor: 'middle'
        });
    }
    y += 110;
    s += rect(x, y, w, 120, { fill: FILL });
    s += text(x + 8, y + 20, 'Seasonal card + species spotlight', { size: 10 });
    return s;
}

function aiChatSlot(x, y, w) {
    let s = rect(x, y, w, 520, { fill: FILL });
    s += text(x + 12, y + 24, 'Tour help — Bwindi assistant', { size: 12, weight: 'bold' });
    s += rect(x + 12, y + 44, w - 24, 100, { fill: WHITE });
    s += text(x + 24, y + 90, 'Hi + Start conversation CTA', { size: 9, fill: MUTED });
    s += rect(x + 12, y + 156, (w - 36) / 2, 48, { fill: WHITE });
    s += rect(x + 24 + (w - 36) / 2, y + 156, (w - 36) / 2, 48, { fill: WHITE });
    s += text(x + 24, y + 220, 'History list (scroll)', { size: 10, weight: 'bold' });
    s += rect(x + 12, y + 236, w - 24, 80, { fill: WHITE });
    s += text(x + 24, y + 340, 'Conversation transcript', { size: 10, weight: 'bold' });
    s += rect(x + 12, y + 356, w - 24, 100, { fill: WHITE });
    s += rect(x + 12, y + 468, w - 24, 44, { fill: WHITE });
    s += text(x + 24, y + 496, 'Composer: textarea · mic · Send', { size: 9, fill: MUTED });
    return s;
}

function mapSlot(x, y, w) {
    let s = imgPlaceholder(x, y, w, 380, 'Leaflet map canvas');
    s += rect(x + 12, y + 12, 180, 80, { fill: WHITE });
    s += text(x + 20, y + 32, 'Layer · Search · Cache', { size: 9 });
    s += rect(x + w - 120, y + 12, 100, 32, { fill: WHITE });
    s += text(x + w - 70, y + 32, 'Coords', { size: 9, anchor: 'middle' });
    return s;
}

function guideDashboardSlot(x, y, w) {
    let s = text(x, y, 'Tour schedule (today)', { size: 10, weight: 'bold' });
    s += rect(x, y + 16, w, 100, { fill: FILL });
    s += text(x, y + 130, 'Weekly assignments', { size: 10, weight: 'bold' });
    s += rect(x, y + 146, w, 120, { fill: FILL });
    s += text(x, y + 280, 'Clock in/out · Active tour mode', { size: 10, weight: 'bold' });
    s += rect(x, y + 296, w, 80, { fill: FILL });
    return s;
}

function itDashboardSlot(x, y, w) {
    let s = text(x, y, 'Metric cards row', { size: 10, weight: 'bold' });
    const mw = (w - 24) / 4;
    for (let i = 0; i < 4; i++) {
        s += rect(x + i * (mw + 8), y + 16, mw, 64, { fill: FILL });
    }
    s += text(x, y + 100, 'Active users (realtime list)', { size: 10, weight: 'bold' });
    s += rect(x, y + 116, w, 140, { fill: FILL });
    s += text(x, y + 270, 'Account directory · Predictive analytics CTA', { size: 10, weight: 'bold' });
    s += rect(x, y + 286, w, 100, { fill: FILL });
    return s;
}

const files = [
    ['01-system-overview-desktop.svg', overviewDesktop()],
    ['02-system-overview-mobile.svg', overviewMobile()],
    ['03-auth-login-desktop.svg', authWireframe(false)],
    ['04-auth-login-mobile.svg', authWireframe(true)],
    ['05-dashboard-desktop.svg', appShellDesktop('Dashboard — Tourist home (desktop)', dashboardSlot)],
    ['06-dashboard-mobile.svg', (() => {
        const W = 390;
        const H = 780;
        let b = header('Dashboard — Tourist home (mobile)', W);
        b += rect(16, 72, W - 32, 48, { fill: WHITE });
        b += text(28, 102, '☰ Home · Online', { size: 10 });
        b += rect(16, 128, W - 32, 580, { fill: WHITE });
        b += dashboardSlot(28, 144, W - 64);
        b += rect(16, 720, W - 32, 48, { fill: FILL_DARK });
        b += text(W / 2, 750, 'Tab bar: Home · Species · Map · Saved · You', { size: 8, anchor: 'middle' });
        return wrapSvg(W, H, b, 'Dashboard mobile');
    })()],
    ['07-animals-catalog-desktop.svg', appShellDesktop('Animals — Biodiversity catalogue (desktop)', (x, y, w) => {
        let s = text(x, y, 'Search · tour themes · species grid', { size: 10, weight: 'bold' });
        s += rect(x, y + 20, w, 48, { fill: FILL });
        const cw = (w - 32) / 3;
        for (let r = 0; r < 2; r++) {
            for (let c = 0; c < 3; c++) {
                s += rect(x + c * (cw + 16), y + 80 + r * 180, cw, 160, { fill: FILL });
                s += imgPlaceholder(x + c * (cw + 16) + 8, y + 88 + r * 180, cw - 16, 80, 'Tile');
            }
        }
        return s;
    })],
    ['08-map-desktop.svg', appShellDesktop('Map — Live Bwindi map (desktop)', mapSlot)],
    ['09-ai-chat-desktop.svg', appShellDesktop('Tour help — AI chat (desktop)', aiChatSlot)],
    ['10-guide-dashboard-desktop.svg', appShellDesktop('Guide dashboard (desktop)', guideDashboardSlot)],
    ['11-it-dashboard-desktop.svg', appShellDesktop('IT manager dashboard (desktop)', itDashboardSlot)],
    ['12-architecture-context.svg', (() => {
        const W = 1200;
        const H = 520;
        let b = header('Figure 3 — SIGTS high-level context', W);
        b += rect(80, 100, 1040, 380, { fill: WHITE });
        const boxes = [
            [120, 140, 200, 80, 'Tourist\n(browser)'],
            [120, 260, 200, 80, 'Tour guide\n(browser)'],
            [120, 380, 200, 80, 'IT manager\n(browser)'],
            [440, 200, 320, 160, 'SIGTS frontend\n(HTML/JS SPA)'],
            [840, 160, 240, 100, 'SIGTS API\n(Node/Express)'],
            [840, 300, 240, 100, 'PostgreSQL\n+ Redis']
        ];
        boxes.forEach(([x, y, w, h, t]) => {
            b += rect(x, y, w, h, { fill: FILL });
            t.split('\n').forEach((line, i) => {
                b += text(x + w / 2, y + h / 2 - 8 + i * 16, line, { size: 11, anchor: 'middle' });
            });
        });
        b += text(360, 280, '→', { size: 24, anchor: 'middle' });
        b += text(780, 220, '→', { size: 24, anchor: 'middle' });
        b += text(780, 340, '→', { size: 24, anchor: 'middle' });
        return wrapSvg(W, H, b, 'SIGTS architecture context');
    })()]
];

files.forEach(([name, content]) => {
    fs.writeFileSync(path.join(OUT, name), content, 'utf8');
    console.log('Wrote', name);
});

console.log(`\nDone — ${files.length} wireframes in ${OUT}`);
