-- Staying-safe wildlife encounters + tourist biodiversity highlights
-- Source: https://www.bwindiimpenetrablenationalpark.com/travel-guide/staying-safe/

INSERT INTO safety_tips (tip_id, park_id, title, content, category, priority, is_active)
SELECT gen_random_uuid(), p.park_id,
  'Gorilla viewing distance',
  'Keep at least 7 m (about 23 ft) from mountain gorillas. This limits disease spread and stress. If a gorilla approaches, stay calm, crouch slightly, and follow your ranger—no sudden moves or loud noises.',
  'wildlife', 1, true
FROM parks p
WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM safety_tips t WHERE t.title = 'Gorilla viewing distance' AND t.park_id = p.park_id);

INSERT INTO safety_tips (tip_id, park_id, title, content, category, priority, is_active)
SELECT gen_random_uuid(), p.park_id,
  'Forest elephant encounter',
  'African forest elephants can be unpredictable. If you see or hear one, stay calm, keep a safe distance, and retreat slowly without turning your back. Never block their escape route.',
  'wildlife', 2, true
FROM parks p
WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM safety_tips t WHERE t.title = 'Forest elephant encounter' AND t.park_id = p.park_id);

INSERT INTO safety_tips (tip_id, park_id, title, content, category, priority, is_active)
SELECT gen_random_uuid(), p.park_id,
  'Monkeys and smaller primates',
  $$Colobus, L'Hoest's, blue monkeys, and baboons are common along forest edges. Do not feed or touch them. Sudden approaches can provoke aggression. Keep food packed away on trails.$$,
  'wildlife', 3, true
FROM parks p
WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM safety_tips t WHERE t.title = 'Monkeys and smaller primates' AND t.park_id = p.park_id);

INSERT INTO safety_tips (tip_id, park_id, title, content, category, priority, is_active)
SELECT gen_random_uuid(), p.park_id,
  'Forest buffalo and antelope',
  'Forest buffalo and shy antelope (bushbuck, duikers) share trekking corridors. Give herds space, stay on marked paths, and let your guide lead—never sprint past wildlife.',
  'wildlife', 4, true
FROM parks p
WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM safety_tips t WHERE t.title = 'Forest buffalo and antelope' AND t.park_id = p.park_id);

INSERT INTO destination_info (destinfo_id, park_id, category, title, content_en, sort_order, is_active, is_emergency)
SELECT gen_random_uuid(), p.park_id, 'health',
  'Staying safe in Bwindi (wildlife overview)',
  'Bwindi is famous for mountain gorillas, but you may also meet forest elephants, primates, antelope, buffalo, birds, and elusive predators. SIGTS highlights the species tourists most often encounter and pairs each with ranger-backed safety guidance drawn from the official Bwindi travel guide. Vaccinations, malaria prevention, trekking fitness, and travel insurance remain essential before you enter the forest.',
  5, true, false
FROM parks p
WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (
    SELECT 1 FROM destination_info d
    WHERE d.park_id = p.park_id AND d.title = 'Staying safe in Bwindi (wildlife overview)'
  );

INSERT INTO destination_info (destinfo_id, park_id, category, title, content_en, sort_order, is_active, is_emergency)
SELECT gen_random_uuid(), p.park_id, 'rules',
  'Golden rules of gorilla trekking',
  '1) Stay at least 7 m from gorillas. 2) Follow your guide at all times. 3) No sudden movements or loud noises. 4) Avoid prolonged direct eye contact. 5) Do not eat or drink near gorillas. 6) If you feel unwell, tell rangers before the trek—human colds can harm gorillas.',
  1, true, false
FROM parks p
WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (
    SELECT 1 FROM destination_info d
    WHERE d.park_id = p.park_id AND d.title = 'Golden rules of gorilla trekking'
  );

UPDATE animals SET image_urls = ARRAY[
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/066_Silverback_mountain_gorilla_eating_at_Bwindi_Impenetrable_Forest_National_Park_Photo_by_Giles_Laurent.jpg/960px-066_Silverback_mountain_gorilla_eating_at_Bwindi_Impenetrable_Forest_National_Park_Photo_by_Giles_Laurent.jpg'
]
WHERE name = 'Mountain Gorilla'
  AND (image_urls IS NULL OR cardinality(image_urls) = 0);

UPDATE animals SET image_urls = ARRAY[
  'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/African_forest_elephant_%28Loxodonta_cyclotis%29_calf.jpg/960px-African_forest_elephant_%28Loxodonta_cyclotis%29_calf.jpg'
]
WHERE name = 'African Forest Elephant'
  AND (image_urls IS NULL OR cardinality(image_urls) = 0);
