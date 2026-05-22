const path = require('path');
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
        ['Ranger Post South', 'Security and ranger support post', 'ranger_post', -1.1124, 29.7315],
        ['Ivy River Crossing', 'Lowland crossing point used in wet-season routing', 'trail', -1.0795, 29.7128],
        ['Bamboo Crest Trail', 'Steeper upper trail with high-elevation bamboo coverage', 'trail', -1.0926, 29.7248],
        ['Community Cultural Point', 'Designated cultural storytelling and community briefing point', 'viewpoint', -1.0718, 29.6975]
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

async function ensureAnimalLocations() {
    const pairs = [
        ['Mountain Gorilla', 'Munyaga River Trail'],
        ['Mountain Gorilla', 'Bamboo Crest Trail'],
        ['Great Blue Turaco', 'Ruhija Ridge Viewpoint'],
        ['African Forest Elephant', 'Ivy River Crossing']
    ];
    for (const [animalName, locationName] of pairs) {
        await pool.query(
            `INSERT INTO animal_locations (animal_id, location_id)
             SELECT a.animal_id, l.location_id
             FROM animals a
             JOIN locations l ON l.name = $2
             WHERE a.name = $1
               AND NOT EXISTS (
                    SELECT 1 FROM animal_locations al
                    WHERE al.animal_id = a.animal_id
                      AND al.location_id = l.location_id
               )`,
            [animalName, locationName]
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
    const routeConfigs = [
        {
            name: 'Bwindi Scenic Forest Circuit',
            description: 'Interactive route linking gate, trail, ridge and ranger post',
            line: 'LINESTRING(29.6612 -1.0482, 29.6830 -1.0540, 29.7420 -1.0643, 29.7315 -1.1124)',
            distanceKm: 8.7,
            durationHours: 4.5,
            difficulty: 'moderate',
            elevationProfile: { gain_m: 180, max_m: 2140, min_m: 1880, segments: [24, 36, 41, 28] },
            stops: ['Buhoma Gate', 'Munyaga River Trail', 'Ruhija Ridge Viewpoint', 'Ranger Post South']
        },
        {
            name: 'Buhoma Intro Loop',
            description: 'Short route for onboarding and panel demonstrations.',
            line: 'LINESTRING(29.6612 -1.0482, 29.6830 -1.0540, 29.6975 -1.0718)',
            distanceKm: 4.1,
            durationHours: 2.0,
            difficulty: 'easy',
            elevationProfile: { gain_m: 70, max_m: 1960, min_m: 1870, segments: [18, 22, 19] },
            stops: ['Buhoma Gate', 'Munyaga River Trail', 'Community Cultural Point']
        },
        {
            name: 'Ridge Challenge Trek',
            description: 'Steeper highland route used for advanced trek planning.',
            line: 'LINESTRING(29.6975 -1.0718, 29.7248 -1.0926, 29.7315 -1.1124)',
            distanceKm: 6.4,
            durationHours: 4.0,
            difficulty: 'difficult',
            elevationProfile: { gain_m: 260, max_m: 2280, min_m: 1930, segments: [31, 40, 48] },
            stops: ['Community Cultural Point', 'Bamboo Crest Trail', 'Ranger Post South']
        }
    ];

    for (const routeConfig of routeConfigs) {
        await pool.query(
            `INSERT INTO tour_routes (route_id, name, description, path_geometry, distance_km, duration_hours, difficulty, elevation_profile)
             SELECT gen_random_uuid(), $1::varchar, $2::text,
                    ST_GeomFromText($3::text, 4326),
                    $4::numeric, $5::numeric, $6::varchar, $7::jsonb
             WHERE NOT EXISTS (SELECT 1 FROM tour_routes WHERE name = $1::varchar)`,
            [
                routeConfig.name,
                routeConfig.description,
                routeConfig.line,
                routeConfig.distanceKm,
                routeConfig.durationHours,
                routeConfig.difficulty,
                JSON.stringify(routeConfig.elevationProfile)
            ]
        );

        const route = await getId('SELECT route_id FROM tour_routes WHERE name = $1 LIMIT 1', [routeConfig.name]);
        if (!route) continue;

        const locRows = await pool.query(
            `SELECT location_id, name
             FROM locations
             WHERE name = ANY($1::text[])`,
            [routeConfig.stops]
        );

        for (let i = 0; i < routeConfig.stops.length; i++) {
            const stopName = routeConfig.stops[i];
            const found = locRows.rows.find((r) => r.name === stopName);
            if (!found) continue;
            await pool.query(
                `INSERT INTO route_locations (route_id, stop_order, location_id, estimated_time_from_prev, stop_duration, points_of_interest)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (route_id, stop_order) DO UPDATE
                 SET location_id = EXCLUDED.location_id,
                     estimated_time_from_prev = EXCLUDED.estimated_time_from_prev,
                     stop_duration = EXCLUDED.stop_duration,
                     points_of_interest = EXCLUDED.points_of_interest`,
                [route.route_id, i + 1, found.location_id, i === 0 ? 0 : 30, 18, stopName]
            );
        }
    }

    const scheduledRoute = await getId('SELECT route_id FROM tour_routes WHERE name = $1 LIMIT 1', ['Bwindi Scenic Forest Circuit']);
    const ongoingRoute = await getId('SELECT route_id FROM tour_routes WHERE name = $1 LIMIT 1', ['Buhoma Intro Loop']);
    if (!scheduledRoute || !ongoingRoute) return;

    await pool.query(
        `INSERT INTO tour_sessions (tour_session_id, scheduled_start, status, group_size, current_lat, current_lng, tourguide_id, route_id, park_id)
         SELECT gen_random_uuid(), NOW() + INTERVAL '2 hours', 'scheduled', 6, -1.0482, 29.6612, $1::uuid, $2::uuid, $3::uuid
         WHERE NOT EXISTS (
            SELECT 1 FROM tour_sessions
            WHERE tourguide_id = $1::uuid
              AND status = 'scheduled'
              AND scheduled_start::date = CURRENT_DATE
         )`,
        [guideProfileId, scheduledRoute.route_id, parkId]
    );
    await pool.query(
        `INSERT INTO tour_sessions (tour_session_id, scheduled_start, actual_start, status, group_size, current_lat, current_lng, tourguide_id, route_id, park_id)
         SELECT gen_random_uuid(), NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '25 minutes', 'ongoing', 5, -1.0604, 29.7001, $1::uuid, $2::uuid, $3::uuid
         WHERE NOT EXISTS (
            SELECT 1 FROM tour_sessions
            WHERE tourguide_id = $1::uuid
              AND status = 'ongoing'
         )`,
        [guideProfileId, ongoingRoute.route_id, parkId]
    );

    const activeTours = await pool.query(
        `SELECT tour_session_id
         FROM tour_sessions
         WHERE tourguide_id = $1
           AND status IN ('ongoing', 'scheduled')
         ORDER BY scheduled_start DESC
         LIMIT 2`,
        [guideProfileId]
    );
    if (touristProfileId) {
        for (const tour of activeTours.rows) {
            await pool.query(
                `INSERT INTO tour_participants (tour_session_id, tourist_id, pickup_location)
                 VALUES ($1, $2, 'Buhoma Gate')
                 ON CONFLICT (tour_session_id, tourist_id) DO NOTHING`,
                [tour.tour_session_id, touristProfileId]
            );
        }
    }
}

async function ensureNavigationPaths() {
    try {
        const links = await pool.query(
            `SELECT l.location_id, l.name
             FROM locations l
             WHERE l.name IN ('Buhoma Gate', 'Munyaga River Trail', 'Ruhija Ridge Viewpoint', 'Bamboo Crest Trail')
             ORDER BY l.name`
        );
        const byName = Object.fromEntries(links.rows.map((row) => [row.name, row.location_id]));
        const paths = [
            {
                locationName: 'Munyaga River Trail',
                line: 'LINESTRING(29.6612 -1.0482, 29.6830 -1.0540)',
                distanceKm: 2.6,
                timeMin: 42,
                difficulty: 'easy',
                gain: 65,
                terrain: 'Moist forest floor, low incline, occasional muddy spots.',
                steps: ['Start from Buhoma Gate', 'Follow river-side boardwalk', 'Cross the small wooden bridge']
            },
            {
                locationName: 'Ruhija Ridge Viewpoint',
                line: 'LINESTRING(29.6830 -1.0540, 29.7420 -1.0643)',
                distanceKm: 3.9,
                timeMin: 68,
                difficulty: 'moderate',
                gain: 140,
                terrain: 'Ridge path with gradual switchbacks and exposed viewpoints.',
                steps: ['Exit Munyaga trail eastward', 'Climb switchback section', 'Proceed to ridge marker stones']
            },
            {
                locationName: 'Bamboo Crest Trail',
                line: 'LINESTRING(29.6975 -1.0718, 29.7248 -1.0926)',
                distanceKm: 3.2,
                timeMin: 74,
                difficulty: 'difficult',
                gain: 230,
                terrain: 'Steep bamboo ascent with slippery sections in rainy weather.',
                steps: ['Start at Community Cultural Point', 'Follow red trail blazes', 'Use ropes at final ascent section']
            }
        ];

        for (const path of paths) {
            const locationId = byName[path.locationName];
            if (!locationId) continue;
            await pool.query(
                `INSERT INTO navigation_paths (
                    path_id, path_geometry, distance_km, estimated_time_minutes, difficulty, elevation_gain,
                    terrain_description, navigation_steps, voice_guidance_file, is_active, location_id
                )
                SELECT gen_random_uuid(), ST_GeomFromText($1::text, 4326), $2::numeric, $3::integer, $4::varchar, $5::numeric,
                       $6::text, $7::jsonb, $8::text, true, $9::uuid
                WHERE NOT EXISTS (
                    SELECT 1 FROM navigation_paths
                    WHERE location_id = $9::uuid
                      AND difficulty = $4::varchar
                )`,
                [
                    path.line,
                    path.distanceKm,
                    path.timeMin,
                    path.difficulty,
                    path.gain,
                    path.terrain,
                    JSON.stringify(path.steps),
                    null,
                    locationId
                ]
            );
        }
    } catch (error) {
        console.warn('Skipping navigation path seed (table not available in current schema).');
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
        const sightings = [
            ['Mountain Gorilla', 'Munyaga River Trail', 3, 'Family cluster moving uphill'],
            ['Great Blue Turaco', 'Ruhija Ridge Viewpoint', 5, 'Canopy feeding activity'],
            ['African Elephant', 'Ivy River Crossing', 2, 'Tracks and partial visual near crossing']
        ];
        for (const [animalName, locationName, count, notes] of sightings) {
            await pool.query(
                `INSERT INTO sightings (sighting_id, animal_id, location_id, number_observed, behavior, verification_status, notes)
                 SELECT gen_random_uuid(), a.animal_id, l.location_id, $3::integer, 'Observed during patrol', 'verified', $4::text
                 FROM animals a
                 JOIN locations l ON l.name = $2
                 WHERE a.name = $1
                   AND NOT EXISTS (
                        SELECT 1 FROM sightings s
                        WHERE s.animal_id = a.animal_id
                          AND s.location_id = l.location_id
                   )`,
                [animalName, locationName, count, notes]
            );
        }
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
        let touristUser = await getId("SELECT user_id FROM users WHERE username = 'demo_tourist' LIMIT 1");
        if (!touristUser) {
            touristUser = await getId("SELECT user_id FROM users WHERE username = 'test_tourist' LIMIT 1");
        }
        const itUser =
            (await getId("SELECT user_id FROM users WHERE username = 'demo_it' LIMIT 1")) ||
            (await getId("SELECT user_id FROM users WHERE username = 'demo_admin' LIMIT 1"));

        if (!guideUser || !touristUser || !itUser) {
            throw new Error('Demo accounts missing. Run resetDemoAccounts.js or seed.js first.');
        }

        const guideProfile = await getId('SELECT tourguide_id FROM tour_guides WHERE user_id = $1 LIMIT 1', [guideUser.user_id]);
        const touristProfile = await getId('SELECT tourist_id FROM tourists WHERE user_id = $1 LIMIT 1', [touristUser.user_id]);
        if (!guideProfile || !touristProfile) {
            throw new Error('Guide/Tourist profiles missing.');
        }

        console.log(' - locations');
        await ensureLocations(park.park_id);
        console.log(' - animal-location links');
        await ensureAnimalLocations();
        console.log(' - cultural narratives');
        await ensureCulturalNarratives(itUser.user_id);
        console.log(' - routes and tours');
        await ensureRoutesAndTours(park.park_id, guideProfile.tourguide_id, touristProfile.tourist_id);
        console.log(' - navigation paths');
        await ensureNavigationPaths();
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
