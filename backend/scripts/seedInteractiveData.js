const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'sigts_bwindi',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'sigts@t'
});

async function getId(query, params = []) {
    const result = await pool.query(query, params);
    return result.rows[0] || null;
}

async function ensureLocations(parkId) {
    const locations = [
        ['Buhoma Gate', 'Main park entrance and tourist check-in point', 'gate', -1.0482, 29.6612],
        ['Munyaga River Trail', 'Forest walk trail with birding opportunities', 'trail', -1.0540, 29.6830],
        ['Ruhija Ridge Viewpoint', 'High ridge viewpoint with misty mountain views', 'viewpoint', -1.0643, 29.7420],
        ['Nkuringo Camp', 'Guide rest and logistics camp', 'camp', -1.0975, 29.6998],
        ['Ranger Post South', 'Security and ranger support post', 'ranger_post', -1.1124, 29.7315]
    ];

    for (const [name, description, type, lat, lng] of locations) {
        await pool.query(
            `INSERT INTO locations (location_id, name, description, location_type, coordinates, trigger_radius, facilities, park_id)
             SELECT gen_random_uuid(), $1::varchar, $2::text, $3::varchar, ST_SetSRID(ST_MakePoint($4::double precision, $5::double precision), 4326), 80, '[]'::jsonb, $6::uuid
             WHERE NOT EXISTS (SELECT 1 FROM locations WHERE name = $1::varchar)`,
            [name, description, type, lng, lat, parkId]
        );
    }
}

async function ensureCulturalNarratives(authorUserId) {
    try {
        const entries = [
            ['Batwa Forest Wisdom', 'Traditional forest stewardship story', 'Batwa Elder Kato', 'batwa', 'history'],
            ['Songs of the Ridge', 'Community songs performed during seasonal gatherings', 'Mariam Ninsiima', 'bakiga', 'music']
        ];

        for (const [title, body, storyteller, community, storyType] of entries) {
            await pool.query(
                `INSERT INTO cultural_narratives (
                    narrative_id, title_en, narrative_en, storyteller_name, community, story_type,
                    verified_by_community, user_id
                )
                SELECT gen_random_uuid(), $1, $2, $3, $4, $5, true, $6
                WHERE NOT EXISTS (SELECT 1 FROM cultural_narratives WHERE title_en = $1)`,
                [title, body, storyteller, community, storyType, authorUserId]
            );
        }
    } catch (error) {
        console.warn('Skipping cultural narrative seed (schema variant detected).');
    }
}

async function ensureRoutesAndTours(parkId, guideProfileId, touristProfileId) {
    const routeName = 'Bwindi Scenic Forest Circuit';
    await pool.query(
        `INSERT INTO tour_routes (route_id, name, description, path_geometry, distance_km, duration_hours, difficulty)
         SELECT gen_random_uuid(), $1::varchar, $2::text,
                ST_GeomFromText('LINESTRING(29.6612 -1.0482, 29.6830 -1.0540, 29.7420 -1.0643, 29.7315 -1.1124)', 4326),
                8.7, 4.5, 'moderate'
         WHERE NOT EXISTS (SELECT 1 FROM tour_routes WHERE name = $1::varchar)`,
        [routeName, 'Interactive route linking gate, trail, ridge and ranger post']
    );

    const route = await getId('SELECT route_id FROM tour_routes WHERE name = $1 LIMIT 1', [routeName]);
    if (!route) return;

    const locRows = await pool.query(
        `SELECT location_id, name
         FROM locations
         WHERE name IN ('Buhoma Gate', 'Munyaga River Trail', 'Ruhija Ridge Viewpoint', 'Ranger Post South')
         ORDER BY name`
    );
    const ordered = ['Buhoma Gate', 'Munyaga River Trail', 'Ruhija Ridge Viewpoint', 'Ranger Post South'];
    for (let i = 0; i < ordered.length; i++) {
        const found = locRows.rows.find((r) => r.name === ordered[i]);
        if (!found) continue;
        await pool.query(
            `INSERT INTO route_locations (route_id, stop_order, location_id, estimated_time_from_prev, stop_duration, points_of_interest)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (route_id, stop_order) DO NOTHING`,
            [route.route_id, i + 1, found.location_id, i === 0 ? 0 : 35, 20, ordered[i]]
        );
    }

    await pool.query(
        `INSERT INTO tour_sessions (tour_session_id, scheduled_start, status, group_size, current_lat, current_lng, tourguide_id, route_id, park_id)
         SELECT gen_random_uuid(), NOW() + INTERVAL '2 hours', 'scheduled', 6, -1.0482, 29.6612, $1::uuid, $2::uuid, $3::uuid
         WHERE NOT EXISTS (
            SELECT 1 FROM tour_sessions
            WHERE tourguide_id = $1::uuid
              AND scheduled_start::date = CURRENT_DATE
         )`,
        [guideProfileId, route.route_id, parkId]
    );

    const activeTour = await getId(
        `SELECT tour_session_id
         FROM tour_sessions
         WHERE tourguide_id = $1
         ORDER BY scheduled_start DESC
         LIMIT 1`,
        [guideProfileId]
    );
    if (activeTour && touristProfileId) {
        await pool.query(
            `INSERT INTO tour_participants (tour_session_id, tourist_id, pickup_location)
             VALUES ($1, $2, 'Buhoma Gate')
             ON CONFLICT (tour_session_id, tourist_id) DO NOTHING`,
            [activeTour.tour_session_id, touristProfileId]
        );
    }
}

async function ensureIntranetData(authorUserId) {
    await pool.query(
        `INSERT INTO internal_announcements (title, content, priority, author_user_id)
         SELECT 'Morning Operations Brief', 'All guide teams should sync offline content before 7:30 AM departures.', 'high', $1
         WHERE NOT EXISTS (SELECT 1 FROM internal_announcements WHERE title = 'Morning Operations Brief')`,
        [authorUserId]
    );
    await pool.query(
        `INSERT INTO internal_announcements (title, content, priority, author_user_id)
         SELECT 'Trail Maintenance Update', 'Munyaga segment C is slippery after rain. Use alternate footing route.', 'medium', $1
         WHERE NOT EXISTS (SELECT 1 FROM internal_announcements WHERE title = 'Trail Maintenance Update')`,
        [authorUserId]
    );

    await pool.query(
        `INSERT INTO inventory_items (name, quantity, category, status)
         SELECT 'Satellite Radio', 12, 'Communication', 'available'
         WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Satellite Radio')`
    );
    await pool.query(
        `INSERT INTO inventory_items (name, quantity, category, status)
         SELECT 'First Aid Kit', 9, 'Medical', 'low_stock'
         WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE name = 'First Aid Kit')`
    );
    await pool.query(
        `INSERT INTO inventory_items (name, quantity, category, status)
         SELECT 'Rain Poncho', 36, 'Equipment', 'available'
         WHERE NOT EXISTS (SELECT 1 FROM inventory_items WHERE name = 'Rain Poncho')`
    );

    await pool.query(
        `INSERT INTO hr_employees (name, role, department, status, hire_date)
         SELECT 'John Mbabazi', 'Senior Guide', 'Tour Operations', 'active', '2020-01-15'
         WHERE NOT EXISTS (SELECT 1 FROM hr_employees WHERE name = 'John Mbabazi')`
    );
    await pool.query(
        `INSERT INTO hr_employees (name, role, department, status, hire_date)
         SELECT 'Grace Akello', 'IT Manager', 'IT', 'active', '2019-06-10'
         WHERE NOT EXISTS (SELECT 1 FROM hr_employees WHERE name = 'Grace Akello')`
    );
    await pool.query(
        `INSERT INTO hr_employees (name, role, department, status, hire_date)
         SELECT 'Sarah Nyira', 'Ranger', 'Security', 'active', '2020-11-01'
         WHERE NOT EXISTS (SELECT 1 FROM hr_employees WHERE name = 'Sarah Nyira')`
    );
}

async function ensureSightings() {
    try {
        const animal = await getId('SELECT animal_id FROM animals ORDER BY created_at ASC LIMIT 1');
        const location = await getId('SELECT location_id FROM locations ORDER BY created_at ASC LIMIT 1');
        if (!animal || !location) return;

        await pool.query(
            `INSERT INTO sightings (sighting_id, animal_id, location_id, number_observed, behavior, verification_status, notes)
             SELECT gen_random_uuid(), $1, $2, 3, 'Foraging in canopy', 'verified', 'Seeded interactive sighting'
             WHERE NOT EXISTS (
                SELECT 1 FROM sightings
                WHERE animal_id = $1 AND location_id = $2
             )`,
            [animal.animal_id, location.location_id]
        );
    } catch (error) {
        console.warn('Skipping sightings seed (table not available in current schema).');
    }
}

async function run() {
    try {
        console.log('Seeding interactive dataset...');
        const park = await getId('SELECT park_id FROM parks LIMIT 1');
        if (!park) {
            throw new Error('No park found. Run base seed first.');
        }

        const guideUser = await getId("SELECT user_id FROM users WHERE username = 'demo_guide' LIMIT 1");
        const touristUser = await getId("SELECT user_id FROM users WHERE username = 'demo_tourist' LIMIT 1");
        const itUser = await getId("SELECT user_id FROM users WHERE username = 'demo_it' LIMIT 1");

        if (!guideUser || !touristUser || !itUser) {
            throw new Error('Demo accounts missing. Run resetDemoAccounts.js first.');
        }

        const guideProfile = await getId('SELECT tourguide_id FROM tour_guides WHERE user_id = $1 LIMIT 1', [guideUser.user_id]);
        const touristProfile = await getId('SELECT tourist_id FROM tourists WHERE user_id = $1 LIMIT 1', [touristUser.user_id]);
        if (!guideProfile || !touristProfile) {
            throw new Error('Guide/Tourist profiles missing.');
        }

        console.log(' - locations');
        await ensureLocations(park.park_id);
        console.log(' - cultural narratives');
        await ensureCulturalNarratives(itUser.user_id);
        console.log(' - routes and tours');
        await ensureRoutesAndTours(park.park_id, guideProfile.tourguide_id, touristProfile.tourist_id);
        console.log(' - intranet tables');
        await ensureIntranetData(itUser.user_id);
        console.log(' - sightings');
        await ensureSightings();

        console.log('Interactive seed data ready.');
    } catch (error) {
        console.error('Failed interactive seed:', error.stack || error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

run();
