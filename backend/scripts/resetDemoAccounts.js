const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { loadEnv } = require('../src/config/env');
loadEnv();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sigts_bwindi',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'sigts@t'
});

async function createUser({ username, email, password, userType, firstName, lastName }) {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
        `INSERT INTO users (
            user_id, username, password_hash, email, first_name, last_name, user_type, is_active
        ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, true
        )
        RETURNING user_id, username, user_type`,
        [username, passwordHash, email, firstName, lastName, userType]
    );
    return result.rows[0];
}

async function run() {
    const candidateTables = [
        'geofence_events',
        'location_history',
        'password_reset_tokens',
        'user_mfa_configs',
        'sync_queue',
        'notifications',
        'feedback',
        'ai_query_logs',
        'tourist_progress',
        'visitor_flow',
        'tour_recommendations',
        'audit_logs',
        'sightings',
        'guide_shifts',
        'tour_participants',
        'tour_sessions',
        'tourists',
        'tour_guides',
        'it_managers',
        'users'
    ];
    const existingTableRows = await pool.query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = ANY($1::text[])`,
        [candidateTables]
    );
    const existingTables = existingTableRows.rows.map((row) => row.table_name);
    if (existingTables.length > 0) {
        await pool.query(`TRUNCATE TABLE ${existingTables.join(', ')} RESTART IDENTITY CASCADE`);
    }

    const tourist = await createUser({
        username: 'demo_tourist',
        email: 'tourist@sigts.local',
        password: 'Tourist123!',
        userType: 'tourist',
        firstName: 'Demo',
        lastName: 'Tourist'
    });
    const guide = await createUser({
        username: 'demo_guide',
        email: 'guide@sigts.local',
        password: 'Guide123!',
        userType: 'guide',
        firstName: 'Demo',
        lastName: 'Guide'
    });
    const itManager = await createUser({
        username: 'demo_it',
        email: 'it@sigts.local',
        password: 'ITManager123!',
        userType: 'it_manager',
        firstName: 'IT',
        lastName: 'Manager'
    });
    await createUser({
        username: 'demo_admin',
        email: 'admin@sigts.local',
        password: 'Admin123!',
        userType: 'admin',
        firstName: 'System',
        lastName: 'Admin'
    });

    await pool.query(
        `INSERT INTO tourists (tourist_id, user_id, interests)
         VALUES (gen_random_uuid(), $1, '[]'::jsonb)`,
        [tourist.user_id]
    );
    await pool.query(
        `INSERT INTO tour_guides (tourguide_id, user_id, license_number, specialization, languages)
         VALUES (gen_random_uuid(), $1, $2, '[]'::jsonb, '[]'::jsonb)`,
        [guide.user_id, 'GUIDE-DEMO-001']
    );
    await pool.query(
        `INSERT INTO it_managers (itmanager_id, user_id, employee_id, access_level)
         VALUES (gen_random_uuid(), $1, $2, 'admin')`,
        [itManager.user_id, 'ITM-DEMO-001']
    );

    console.log('Demo accounts reset complete.');
}

run()
    .catch((error) => {
        console.error('Failed to reset demo accounts:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
