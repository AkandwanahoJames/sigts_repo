/**
 * Prepare SIGTS for panel presentation: live DB rows + demo passwords + verification.
 * Run: node scripts/prepare-panel-demo.js
 */
const { execFileSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const node = process.execPath;

function run(label, script, args = []) {
    console.log(`\n▶ ${label}`);
    execFileSync(node, [path.join(__dirname, script), ...args], {
        cwd: root,
        stdio: 'inherit',
        env: process.env
    });
}

try {
    console.log('=== SIGTS Panel Demo Preparation ===');
    run('Interactive seed (tours, sightings, intranet, routes)', 'seedInteractiveData.js');
    const passwords = [
        ['test_tourist', 'Test123!'],
        ['demo_tourist', 'Test123!'],
        ['demo_guide', 'Test123!'],
        ['demo_it', 'Test123!'],
        ['demo_admin', 'Test123!']
    ];
    for (const [user, pass] of passwords) {
        try {
            run(`Password ${user}`, 'setUserPassword.js', [user, pass]);
        } catch (e) {
            console.warn(`  (skip ${user}: ${e.message})`);
        }
    }
    run('Requirements verification', 'verify-requirements.js');
    console.log('\n✅ Panel prep complete. Start backend :8001 and frontend :3000, then hard-refresh the browser.');
} catch (e) {
    console.error('\n❌ Panel prep failed:', e.message);
    process.exit(1);
}
