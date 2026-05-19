-- Bwindi travel-guide enrichment: cultural stories, sector trails, map routes
-- Source: https://www.bwindiimpenetrablenationalpark.com/travel-guide/staying-safe/
--          sector & community-tourism pages on bwindiimpenetrablenationalpark.com

-- ========== SECTOR & COMMUNITY LOCATIONS ==========

INSERT INTO locations (location_id, name, description, location_type, coordinates, trigger_radius, facilities, park_id)
SELECT gen_random_uuid(), 'Rushaga Sector Gate',
  'Southern Bwindi sector check-in for Rushaga gorilla groups and forest walks. Steep ridge approaches—pace for mud after rain.',
  'gate', ST_SetSRID(ST_MakePoint(29.6480::double precision, -1.0880::double precision), 4326), 90, '[]'::jsonb, p.park_id
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM locations WHERE name = 'Rushaga Sector Gate');

INSERT INTO locations (location_id, name, description, location_type, coordinates, trigger_radius, facilities, park_id)
SELECT gen_random_uuid(), 'Ruhija Sector Gate',
  'High-elevation Ruhija sector—flagship Albertine birding and bamboo-fern understory treks. Cool mornings, mist common.',
  'gate', ST_SetSRID(ST_MakePoint(29.7380::double precision, -1.0620::double precision), 4326), 90, '[]'::jsonb, p.park_id
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM locations WHERE name = 'Ruhija Sector Gate');

INSERT INTO locations (location_id, name, description, location_type, coordinates, trigger_radius, facilities, park_id)
SELECT gen_random_uuid(), 'Nyundo Community Trails',
  'Community-managed forest walks near Buhoma buffer—cultural briefings, craft demos, and ridge views with local guides.',
  'trail', ST_SetSRID(ST_MakePoint(29.7050::double precision, -1.0750::double precision), 4326), 80, '[]'::jsonb, p.park_id
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM locations WHERE name = 'Nyundo Community Trails');

INSERT INTO locations (location_id, name, description, location_type, coordinates, trigger_radius, facilities, park_id)
SELECT gen_random_uuid(), 'Rubuguri Village Walk',
  'Rubuguri community tourism circuit—homestead visits, dance, and conservation benefit-sharing stories on the park edge.',
  'viewpoint', ST_SetSRID(ST_MakePoint(29.6750::double precision, -1.1020::double precision), 4326), 80, '[]'::jsonb, p.park_id
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM locations WHERE name = 'Rubuguri Village Walk');

INSERT INTO locations (location_id, name, description, location_type, coordinates, trigger_radius, facilities, park_id)
SELECT gen_random_uuid(), 'Batwa Cultural Heritage Point',
  'Designated Batwa cultural experience briefing area—forest memory, traditional skills, and respectful visitor etiquette.',
  'viewpoint', ST_SetSRID(ST_MakePoint(29.6920::double precision, -1.0680::double precision), 4326), 80, '[]'::jsonb, p.park_id
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM locations WHERE name = 'Batwa Cultural Heritage Point');

-- ========== TOURIST MAP ROUTES (sector & community trails) ==========

INSERT INTO tour_routes (route_id, name, description, path_geometry, distance_km, duration_hours, difficulty, elevation_profile)
SELECT gen_random_uuid(),
  'Buhoma Munyaga Nature Walk',
  'Classic Buhoma forest walk from the main gate along the Munyaga river corridor—birding, primates, and gentle inclines for first-day acclimatisation.',
  ST_GeomFromText('LINESTRING(29.6612 -1.0482, 29.6830 -1.0540, 29.6975 -1.0718)', 4326),
  4.2, 2.5, 'easy', '{"gain_m":85,"max_m":1960,"min_m":1870,"segments":[20,28,22]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM tour_routes WHERE name = 'Buhoma Munyaga Nature Walk');

INSERT INTO tour_routes (route_id, name, description, path_geometry, distance_km, duration_hours, difficulty, elevation_profile)
SELECT gen_random_uuid(),
  'Ruhija Ridge Birding Trail',
  'Ruhija sector ridge ascent through bamboo and moss forest—Albertine endemics, mist viewpoints, and steeper afternoon mud.',
  ST_GeomFromText('LINESTRING(29.7380 -1.0620, 29.7420 -1.0643, 29.7248 -1.0926)', 4326),
  5.8, 3.5, 'moderate', '{"gain_m":210,"max_m":2380,"min_m":2150,"segments":[25,38,42]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM tour_routes WHERE name = 'Ruhija Ridge Birding Trail');

INSERT INTO tour_routes (route_id, name, description, path_geometry, distance_km, duration_hours, difficulty, elevation_profile)
SELECT gen_random_uuid(),
  'Nkuringo Community Cultural Walk',
  'Nkuringo sector community loop linking camp logistics with cultural storytelling and steep ridge panoramas.',
  ST_GeomFromText('LINESTRING(29.6998 -1.0975, 29.6975 -1.0718, 29.6920 -1.0680)', 4326),
  3.6, 2.0, 'moderate', '{"gain_m":120,"max_m":2280,"min_m":2100,"segments":[22,30,18]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM tour_routes WHERE name = 'Nkuringo Community Cultural Walk');

INSERT INTO tour_routes (route_id, name, description, path_geometry, distance_km, duration_hours, difficulty, elevation_profile)
SELECT gen_random_uuid(),
  'Rushaga Forest Trek Corridor',
  'Southern Rushaga approach through Ivy River crossings and forest elephant paths—full-day fitness recommended.',
  ST_GeomFromText('LINESTRING(29.6480 -1.0880, 29.7128 -1.0795, 29.7248 -1.0926)', 4326),
  7.4, 4.5, 'difficult', '{"gain_m":340,"max_m":2450,"min_m":1980,"segments":[30,45,50]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM tour_routes WHERE name = 'Rushaga Forest Trek Corridor');

INSERT INTO tour_routes (route_id, name, description, path_geometry, distance_km, duration_hours, difficulty, elevation_profile)
SELECT gen_random_uuid(),
  'Batwa Heritage & Community Trail',
  'Cultural heritage circuit: community briefings, Batwa forest memory, and bamboo-crest viewpoints with local interpreters.',
  ST_GeomFromText('LINESTRING(29.6612 -1.0482, 29.6920 -1.0680, 29.7050 -1.0750, 29.6750 -1.1020)', 4326),
  6.1, 3.0, 'moderate', '{"gain_m":160,"max_m":2200,"min_m":1870,"segments":[24,32,28,26]}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM tour_routes WHERE name = 'Batwa Heritage & Community Trail');

-- Route stops (idempotent via route name + stop order)

INSERT INTO route_locations (route_id, stop_order, location_id, estimated_time_from_prev, stop_duration, points_of_interest)
SELECT tr.route_id, 1, l.location_id, 0, 20, 'Buhoma Gate'
FROM tour_routes tr
JOIN locations l ON l.name = 'Buhoma Gate'
WHERE tr.name = 'Buhoma Munyaga Nature Walk'
  AND NOT EXISTS (SELECT 1 FROM route_locations rl WHERE rl.route_id = tr.route_id AND rl.stop_order = 1);

INSERT INTO route_locations (route_id, stop_order, location_id, estimated_time_from_prev, stop_duration, points_of_interest)
SELECT tr.route_id, 2, l.location_id, 35, 25, 'Munyaga River Trail'
FROM tour_routes tr
JOIN locations l ON l.name = 'Munyaga River Trail'
WHERE tr.name = 'Buhoma Munyaga Nature Walk'
  AND NOT EXISTS (SELECT 1 FROM route_locations rl WHERE rl.route_id = tr.route_id AND rl.stop_order = 2);

INSERT INTO route_locations (route_id, stop_order, location_id, estimated_time_from_prev, stop_duration, points_of_interest)
SELECT tr.route_id, 3, l.location_id, 30, 20, 'Community Cultural Point'
FROM tour_routes tr
JOIN locations l ON l.name = 'Community Cultural Point'
WHERE tr.name = 'Buhoma Munyaga Nature Walk'
  AND NOT EXISTS (SELECT 1 FROM route_locations rl WHERE rl.route_id = tr.route_id AND rl.stop_order = 3);

INSERT INTO route_locations (route_id, stop_order, location_id, estimated_time_from_prev, stop_duration, points_of_interest)
SELECT tr.route_id, 1, l.location_id, 0, 15, 'Ruhija Sector Gate'
FROM tour_routes tr
JOIN locations l ON l.name = 'Ruhija Sector Gate'
WHERE tr.name = 'Ruhija Ridge Birding Trail'
  AND NOT EXISTS (SELECT 1 FROM route_locations rl WHERE rl.route_id = tr.route_id AND rl.stop_order = 1);

INSERT INTO route_locations (route_id, stop_order, location_id, estimated_time_from_prev, stop_duration, points_of_interest)
SELECT tr.route_id, 2, l.location_id, 40, 30, 'Ruhija Ridge Viewpoint'
FROM tour_routes tr
JOIN locations l ON l.name = 'Ruhija Ridge Viewpoint'
WHERE tr.name = 'Ruhija Ridge Birding Trail'
  AND NOT EXISTS (SELECT 1 FROM route_locations rl WHERE rl.route_id = tr.route_id AND rl.stop_order = 2);

INSERT INTO route_locations (route_id, stop_order, location_id, estimated_time_from_prev, stop_duration, points_of_interest)
SELECT tr.route_id, 3, l.location_id, 50, 25, 'Bamboo Crest Trail'
FROM tour_routes tr
JOIN locations l ON l.name = 'Bamboo Crest Trail'
WHERE tr.name = 'Ruhija Ridge Birding Trail'
  AND NOT EXISTS (SELECT 1 FROM route_locations rl WHERE rl.route_id = tr.route_id AND rl.stop_order = 3);

INSERT INTO route_locations (route_id, stop_order, location_id, estimated_time_from_prev, stop_duration, points_of_interest)
SELECT tr.route_id, 1, l.location_id, 0, 20, 'Nkuringo Camp'
FROM tour_routes tr
JOIN locations l ON l.name = 'Nkuringo Camp'
WHERE tr.name = 'Nkuringo Community Cultural Walk'
  AND NOT EXISTS (SELECT 1 FROM route_locations rl WHERE rl.route_id = tr.route_id AND rl.stop_order = 1);

INSERT INTO route_locations (route_id, stop_order, location_id, estimated_time_from_prev, stop_duration, points_of_interest)
SELECT tr.route_id, 2, l.location_id, 35, 25, 'Community Cultural Point'
FROM tour_routes tr
JOIN locations l ON l.name = 'Community Cultural Point'
WHERE tr.name = 'Nkuringo Community Cultural Walk'
  AND NOT EXISTS (SELECT 1 FROM route_locations rl WHERE rl.route_id = tr.route_id AND rl.stop_order = 2);

INSERT INTO route_locations (route_id, stop_order, location_id, estimated_time_from_prev, stop_duration, points_of_interest)
SELECT tr.route_id, 3, l.location_id, 30, 30, 'Batwa Cultural Heritage Point'
FROM tour_routes tr
JOIN locations l ON l.name = 'Batwa Cultural Heritage Point'
WHERE tr.name = 'Nkuringo Community Cultural Walk'
  AND NOT EXISTS (SELECT 1 FROM route_locations rl WHERE rl.route_id = tr.route_id AND rl.stop_order = 3);

INSERT INTO route_locations (route_id, stop_order, location_id, estimated_time_from_prev, stop_duration, points_of_interest)
SELECT tr.route_id, 1, l.location_id, 0, 20, 'Rushaga Sector Gate'
FROM tour_routes tr
JOIN locations l ON l.name = 'Rushaga Sector Gate'
WHERE tr.name = 'Rushaga Forest Trek Corridor'
  AND NOT EXISTS (SELECT 1 FROM route_locations rl WHERE rl.route_id = tr.route_id AND rl.stop_order = 1);

INSERT INTO route_locations (route_id, stop_order, location_id, estimated_time_from_prev, stop_duration, points_of_interest)
SELECT tr.route_id, 2, l.location_id, 55, 20, 'Ivy River Crossing'
FROM tour_routes tr
JOIN locations l ON l.name = 'Ivy River Crossing'
WHERE tr.name = 'Rushaga Forest Trek Corridor'
  AND NOT EXISTS (SELECT 1 FROM route_locations rl WHERE rl.route_id = tr.route_id AND rl.stop_order = 2);

INSERT INTO route_locations (route_id, stop_order, location_id, estimated_time_from_prev, stop_duration, points_of_interest)
SELECT tr.route_id, 3, l.location_id, 45, 25, 'Bamboo Crest Trail'
FROM tour_routes tr
JOIN locations l ON l.name = 'Bamboo Crest Trail'
WHERE tr.name = 'Rushaga Forest Trek Corridor'
  AND NOT EXISTS (SELECT 1 FROM route_locations rl WHERE rl.route_id = tr.route_id AND rl.stop_order = 3);

INSERT INTO route_locations (route_id, stop_order, location_id, estimated_time_from_prev, stop_duration, points_of_interest)
SELECT tr.route_id, 1, l.location_id, 0, 20, 'Buhoma Gate'
FROM tour_routes tr
JOIN locations l ON l.name = 'Buhoma Gate'
WHERE tr.name = 'Batwa Heritage & Community Trail'
  AND NOT EXISTS (SELECT 1 FROM route_locations rl WHERE rl.route_id = tr.route_id AND rl.stop_order = 1);

INSERT INTO route_locations (route_id, stop_order, location_id, estimated_time_from_prev, stop_duration, points_of_interest)
SELECT tr.route_id, 2, l.location_id, 40, 35, 'Batwa Cultural Heritage Point'
FROM tour_routes tr
JOIN locations l ON l.name = 'Batwa Cultural Heritage Point'
WHERE tr.name = 'Batwa Heritage & Community Trail'
  AND NOT EXISTS (SELECT 1 FROM route_locations rl WHERE rl.route_id = tr.route_id AND rl.stop_order = 2);

INSERT INTO route_locations (route_id, stop_order, location_id, estimated_time_from_prev, stop_duration, points_of_interest)
SELECT tr.route_id, 3, l.location_id, 35, 25, 'Nyundo Community Trails'
FROM tour_routes tr
JOIN locations l ON l.name = 'Nyundo Community Trails'
WHERE tr.name = 'Batwa Heritage & Community Trail'
  AND NOT EXISTS (SELECT 1 FROM route_locations rl WHERE rl.route_id = tr.route_id AND rl.stop_order = 3);

INSERT INTO route_locations (route_id, stop_order, location_id, estimated_time_from_prev, stop_duration, points_of_interest)
SELECT tr.route_id, 4, l.location_id, 40, 30, 'Rubuguri Village Walk'
FROM tour_routes tr
JOIN locations l ON l.name = 'Rubuguri Village Walk'
WHERE tr.name = 'Batwa Heritage & Community Trail'
  AND NOT EXISTS (SELECT 1 FROM route_locations rl WHERE rl.route_id = tr.route_id AND rl.stop_order = 4);

-- ========== CULTURAL NARRATIVES (staying-safe guide + community tourism) ==========

INSERT INTO cultural_narratives (
    title_en, narrative_en, storyteller_name, community, story_type,
    cultural_significance, duration, verified_by_community, published_at, image_urls
)
SELECT
    'Guides as cultural ambassadors',
    'UWA-certified guides do more than find gorillas—they read ridge weather, interpret elephant sign, and translate Batwa and Bakiga heritage for visitors. The official Bwindi travel guide calls them your best safety resource: they know alternate paths in rain, position groups at safe wildlife distances, and coordinate evacuations when trails turn treacherous. Listening before you tread is both etiquette and survival wisdom on these steep, humid slopes.',
    'Patrick Byaruhanga',
    'other',
    'tradition',
    'Links ranger leadership with community storytelling and visitor safety culture.',
    8,
    true,
    NOW(),
    ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Bamboo_Trail_Bwindi_Forest_-_panoramio_%281%29.jpg/960px-Bamboo_Trail_Bwindi_Forest_-_panoramio_%281%29.jpg']
WHERE NOT EXISTS (SELECT 1 FROM cultural_narratives WHERE title_en = 'Guides as cultural ambassadors');

INSERT INTO cultural_narratives (
    title_en, narrative_en, storyteller_name, community, story_type,
    cultural_significance, duration, verified_by_community, published_at, image_urls
)
SELECT
    'Batwa forest memory at the heritage point',
    'Before conservation redesignated these ridges, Batwa families read every ravine by seasonal plant names—bitter roots for rain months, sweeter fruits when warm winds climbed the slopes. Today''s Batwa cultural experiences are deliberately paced: interpreters demonstrate fire-making, medicinal plants, and respectful silence so guests do not treat culture as a performance. Permit revenue and community tourism associations aim to share benefits while keeping forest health paramount.',
    'Jovia Katushabe',
    'batwa',
    'history',
    'Connects Batwa displacement narratives with present-day community tourism and conservation partnerships.',
    14,
    true,
    NOW(),
    ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Bwindi_children.jpg/960px-Bwindi_children.jpg']
WHERE NOT EXISTS (SELECT 1 FROM cultural_narratives WHERE title_en = 'Batwa forest memory at the heritage point');

INSERT INTO cultural_narratives (
    title_en, narrative_en, storyteller_name, community, story_type,
    cultural_significance, duration, verified_by_community, published_at, image_urls
)
SELECT
    'Nyundo trails and buffer-zone coexistence',
    'On Nyundo community trails, homestead smoke still drifts downslope toward visitor centres—a reminder that gorilla forests and farmland share horizons. Guides explain how buffer-zone farming, tea plots, and regulated tourism revenue support schools and health posts. Guests are asked to photograph people only with consent and to buy crafts directly from maker cooperatives rather than haggling as if markets were theme parks.',
    'Denis Kahangi',
    'bakiga',
    'history',
    'Frames community tourism walks as economic partners in Bwindi stewardship.',
    10,
    true,
    NOW(),
    ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Bamboo_Trail_Bwindi_Forest.jpg/960px-Bamboo_Trail_Bwindi_Forest.jpg']
WHERE NOT EXISTS (SELECT 1 FROM cultural_narratives WHERE title_en = 'Nyundo trails and buffer-zone coexistence');

INSERT INTO cultural_narratives (
    title_en, narrative_en, storyteller_name, community, story_type,
    cultural_significance, duration, verified_by_community, published_at, image_urls
)
SELECT
    'Rubuguri village songs at dusk',
    'Rubuguri village walks often end with call-and-response songs celebrating harvests and safe returns from forest work. Elders teach that loud celebration belongs outside gorilla sectors—inside the park, the same communities practise whisper-quiet trekking so primates choose their own crossings. It is one village showing two volumes: joy at home, restraint at the forest edge.',
    'Mariam Ninsiima',
    'bakiga',
    'music',
    'Illustrates cultural expression versus wildlife-sensitive behaviour on treks.',
    7,
    true,
    NOW(),
    ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Bamboo_Trail_Bwindi_Forest_-_panoramio_%281%29.jpg/960px-Bamboo_Trail_Bwindi_Forest_-_panoramio_%281%29.jpg']
WHERE NOT EXISTS (SELECT 1 FROM cultural_narratives WHERE title_en = 'Rubuguri village songs at dusk');

UPDATE cultural_narratives
SET published_at = COALESCE(published_at, NOW()),
    verified_by_community = true,
    narrative_en = COALESCE(NULLIF(TRIM(narrative_en), ''), 'Traditional forest stewardship story shared with visiting groups.'),
    cultural_significance = COALESCE(cultural_significance, 'Batwa heritage linked to Bwindi conservation storytelling.')
WHERE title_en = 'Batwa Forest Wisdom';

UPDATE cultural_narratives
SET published_at = COALESCE(published_at, NOW()),
    verified_by_community = true,
    narrative_en = COALESCE(NULLIF(TRIM(narrative_en), ''), 'Community songs performed during seasonal gatherings on the park edge.'),
    cultural_significance = COALESCE(cultural_significance, 'Music traditions that complement—not compete with—wildlife-quiet trekking.')
WHERE title_en = 'Songs of the Ridge';

-- ========== CULTURAL ↔ LOCATION LINKS ==========

INSERT INTO cultural_locations (narrative_id, location_id)
SELECT cn.narrative_id, l.location_id
FROM cultural_narratives cn
JOIN locations l ON l.name = 'Batwa Cultural Heritage Point'
WHERE cn.title_en = 'Batwa forest memory at the heritage point'
  AND NOT EXISTS (
    SELECT 1 FROM cultural_locations cl
    WHERE cl.narrative_id = cn.narrative_id AND cl.location_id = l.location_id
  );

INSERT INTO cultural_locations (narrative_id, location_id)
SELECT cn.narrative_id, l.location_id
FROM cultural_narratives cn
JOIN locations l ON l.name = 'Nyundo Community Trails'
WHERE cn.title_en = 'Nyundo trails and buffer-zone coexistence'
  AND NOT EXISTS (
    SELECT 1 FROM cultural_locations cl
    WHERE cl.narrative_id = cn.narrative_id AND cl.location_id = l.location_id
  );

INSERT INTO cultural_locations (narrative_id, location_id)
SELECT cn.narrative_id, l.location_id
FROM cultural_narratives cn
JOIN locations l ON l.name = 'Rubuguri Village Walk'
WHERE cn.title_en = 'Rubuguri village songs at dusk'
  AND NOT EXISTS (
    SELECT 1 FROM cultural_locations cl
    WHERE cl.narrative_id = cn.narrative_id AND cl.location_id = l.location_id
  );

INSERT INTO cultural_locations (narrative_id, location_id)
SELECT cn.narrative_id, l.location_id
FROM cultural_narratives cn
JOIN locations l ON l.name = 'Community Cultural Point'
WHERE cn.title_en = 'Walking softly with Batwa elders'
  AND NOT EXISTS (
    SELECT 1 FROM cultural_locations cl
    WHERE cl.narrative_id = cn.narrative_id AND cl.location_id = l.location_id
  );

-- ========== CULTURAL ↔ ANIMAL LINKS (gorilla & flagship birds) ==========

INSERT INTO cultural_animals (narrative_id, animal_id)
SELECT cn.narrative_id, a.animal_id
FROM cultural_narratives cn
JOIN animals a ON a.name = 'Mountain Gorilla'
WHERE cn.title_en IN ('Walking softly with Batwa elders', 'Guides as cultural ambassadors', 'Batwa forest memory at the heritage point')
  AND NOT EXISTS (
    SELECT 1 FROM cultural_animals ca
    WHERE ca.narrative_id = cn.narrative_id AND ca.animal_id = a.animal_id
  );

INSERT INTO cultural_animals (narrative_id, animal_id)
SELECT cn.narrative_id, a.animal_id
FROM cultural_narratives cn
JOIN animals a ON a.name = 'Great Blue Turaco'
WHERE cn.title_en = 'Proverb on listening before you tread'
  AND NOT EXISTS (
    SELECT 1 FROM cultural_animals ca
    WHERE ca.narrative_id = cn.narrative_id AND ca.animal_id = a.animal_id
  );

-- ========== TOURIST SPECIES IMAGE REFRESH ==========

UPDATE animals SET image_urls = ARRAY[
  'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Papio_anubis.jpg/960px-Papio_anubis.jpg'
]
WHERE name = 'Olive Baboon'
  AND (image_urls IS NULL OR cardinality(image_urls) = 0);

UPDATE animals SET image_urls = ARRAY[
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Tragelaphus_scriptus.jpg/960px-Tragelaphus_scriptus.jpg'
]
WHERE name = 'Bushbuck'
  AND (image_urls IS NULL OR cardinality(image_urls) = 0);

UPDATE animals SET image_urls = ARRAY[
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Black-and-white_Colobus_Monkeys.jpg/960px-Black-and-white_Colobus_Monkeys.jpg'
]
WHERE name = 'Black-and-white Colobus'
  AND (image_urls IS NULL OR cardinality(image_urls) = 0);

UPDATE animals SET image_urls = ARRAY[
  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Panthera_pardus_close_up.jpg/960px-Panthera_pardus_close_up.jpg'
]
WHERE name = 'African Leopard'
  AND (image_urls IS NULL OR cardinality(image_urls) = 0);

UPDATE animals SET image_urls = ARRAY[
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Corythaeola_cristata.jpg/960px-Corythaeola_cristata.jpg'
]
WHERE name = 'Great Blue Turaco'
  AND (image_urls IS NULL OR cardinality(image_urls) = 0);

UPDATE animals SET image_urls = ARRAY[
  'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Syncerus_caffer_nanus_-_01.jpg/960px-Syncerus_caffer_nanus_-_01.jpg'
]
WHERE name = 'African Forest Buffalo'
  AND (image_urls IS NULL OR cardinality(image_urls) = 0);
