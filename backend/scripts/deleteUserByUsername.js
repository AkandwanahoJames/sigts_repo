/**
 * Permanently remove a user and cascaded rows (by username).
 * Usage: node scripts/deleteUserByUsername.js <username>
 */
const { Pool } = require('pg');
const { loadEnv } = require('../src/config/env');

loadEnv();

const username = (process.argv[2] || '').trim();
if (!username) {
    console.error('Usage: node scripts/deleteUserByUsername.js <username>');
    process.exit(1);
}

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sigts_bwindi',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || (process.env.NODE_ENV === 'development' ? 'sigts@t' : undefined)
});

async function run() {
    const client = await pool.connect();
    try {
        const found = await client.query(
            `SELECT user_id, username, email, user_type, first_name, last_name, phone, created_at
             FROM users
             WHERE LOWER(username) = LOWER($1)`,
            [username]
        );

        if (found.rows.length === 0) {
            console.log(`No user found with username "${username}".`);
            return;
        }

        for (const row of found.rows) {
            console.log('Deleting user:', {
                user_id: row.user_id,
                username: row.username,
                email: row.email,
                user_type: row.user_type
            });

            await client.query('BEGIN');

            // Role-specific profiles (also removed via CASCADE when users row deletes)
            await client.query('DELETE FROM tourists WHERE user_id = $1', [row.user_id]);
            await client.query('DELETE FROM tour_guides WHERE user_id = $1', [row.user_id]);
            await client.query('DELETE FROM it_managers WHERE user_id = $1', [row.user_id]);

            const del = await client.query('DELETE FROM users WHERE user_id = $1 RETURNING user_id', [row.user_id]);
            await client.query('COMMIT');

            if (del.rowCount) {
                console.log(`Removed user_id ${row.user_id} and cascaded related records.`);
            }
        }
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Delete failed:', err.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

run();
