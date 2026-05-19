/**
 * Dev/admin utility: set a user's password when email reset is unavailable.
 * Usage: node scripts/setUserPassword.js <username-or-email> <new-password>
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/database');
const { findUserForLogin } = require('../src/utils/userIdentity');
const { REQUIREMENTS } = require('../src/config/requirements');

const identifier = process.argv[2];
const newPassword = process.argv[3];

if (!identifier || !newPassword) {
    console.error('Usage: node scripts/setUserPassword.js <username-or-email> <new-password>');
    process.exit(1);
}

if (newPassword.length < 4) {
    console.error('Password must be at least 4 characters.');
    process.exit(1);
}

(async () => {
    const match = await findUserForLogin(pool, identifier);
    if (!match) {
        console.error('No user found for:', identifier);
        process.exit(1);
    }
    const rounds = REQUIREMENTS.security.bcryptRounds || 12;
    const hash = await bcrypt.hash(newPassword, rounds);
    await pool.query(
        `UPDATE users SET password_hash = $1 WHERE user_id = $2`,
        [hash, match.user.user_id]
    );
    console.log(`Password updated for ${match.user.username} (${match.user.email})`);
    await pool.end();
})().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
