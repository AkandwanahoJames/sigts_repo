-- Full "Staying Safe" travel guide content for SIGTS
-- Source: https://www.bwindiimpenetrablenationalpark.com/travel-guide/staying-safe/

INSERT INTO safety_tips (tip_id, park_id, title, content, category, priority, is_active)
SELECT gen_random_uuid(), p.park_id, 'Yellow fever certificate',
  $$Yellow fever vaccination is mandatory for entry into Uganda. Carry your certificate and keep a copy with travel documents.$$,
  'health', 1, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM safety_tips t WHERE t.title = 'Yellow fever certificate' AND t.park_id = p.park_id);

INSERT INTO safety_tips (tip_id, park_id, title, content, category, priority, is_active)
SELECT gen_random_uuid(), p.park_id, 'Malaria prophylaxis',
  $$Take prescribed antimalarials before, during, and after your visit. Use DEET repellent, long sleeves, and sleep under treated nets.$$,
  'health', 2, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM safety_tips t WHERE t.title = 'Malaria prophylaxis' AND t.park_id = p.park_id);

INSERT INTO safety_tips (tip_id, park_id, title, content, category, priority, is_active)
SELECT gen_random_uuid(), p.park_id, 'Altitude and hydration',
  $$Bwindi ranges from about 1,160 m to 2,607 m. Pace ascents, drink water regularly, and rest when needed on long treks.$$,
  'health', 3, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM safety_tips t WHERE t.title = 'Altitude and hydration' AND t.park_id = p.park_id);

INSERT INTO safety_tips (tip_id, park_id, title, content, category, priority, is_active)
SELECT gen_random_uuid(), p.park_id, 'Travel insurance with evacuation',
  $$Choose insurance covering trekking, medical care, and helicopter evacuation. Remote terrain can delay hospital access.$$,
  'health', 4, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM safety_tips t WHERE t.title = 'Travel insurance with evacuation' AND t.park_id = p.park_id);

INSERT INTO safety_tips (tip_id, park_id, title, content, category, priority, is_active)
SELECT gen_random_uuid(), p.park_id, 'Gorilla trek illness policy',
  $$Do not trek if you have a contagious illness. Human colds and flu can infect gorillas. Inform rangers before the briefing.$$,
  'wildlife', 1, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM safety_tips t WHERE t.title = 'Gorilla trek illness policy' AND t.park_id = p.park_id);

INSERT INTO safety_tips (tip_id, park_id, title, content, category, priority, is_active)
SELECT gen_random_uuid(), p.park_id, 'No food near gorillas',
  $$Do not eat or drink near gorillas. This prevents contamination and stops them associating humans with food.$$,
  'wildlife', 2, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM safety_tips t WHERE t.title = 'No food near gorillas' AND t.park_id = p.park_id);

INSERT INTO safety_tips (tip_id, park_id, title, content, category, priority, is_active)
SELECT gen_random_uuid(), p.park_id, 'Snakes and insects on trails',
  $$Wear protective boots and stay on designated paths. Avoid tall grass and reach into vegetation blindly.$$,
  'wildlife', 5, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM safety_tips t WHERE t.title = 'Snakes and insects on trails' AND t.park_id = p.park_id);

INSERT INTO safety_tips (tip_id, park_id, title, content, category, priority, is_active)
SELECT gen_random_uuid(), p.park_id, 'Stick to marked trails',
  $$Straying off paths increases risk of getting lost and encountering wildlife unexpectedly. Always follow your guide.$$,
  'general', 2, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM safety_tips t WHERE t.title = 'Stick to marked trails' AND t.park_id = p.park_id);

INSERT INTO safety_tips (tip_id, park_id, title, content, category, priority, is_active)
SELECT gen_random_uuid(), p.park_id, 'Rainforest weather prep',
  $$Sudden rain makes trails muddy within minutes. Carry rain gear and waterproof boots with strong grip.$$,
  'weather', 1, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM safety_tips t WHERE t.title = 'Rainforest weather prep' AND t.park_id = p.park_id);

INSERT INTO safety_tips (tip_id, park_id, title, content, category, priority, is_active)
SELECT gen_random_uuid(), p.park_id, 'Petty theft awareness',
  $$Avoid displaying expensive phones, cameras, or cash in crowds. Use a money belt and modest behaviour in markets.$$,
  'general', 3, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM safety_tips t WHERE t.title = 'Petty theft awareness' AND t.park_id = p.park_id);

INSERT INTO safety_tips (tip_id, park_id, title, content, category, priority, is_active)
SELECT gen_random_uuid(), p.park_id, 'Avoid night road travel',
  $$Driving after dark greatly increases accident risk on Ugandan roads. Plan to reach lodges before nightfall.$$,
  'driving', 1, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM safety_tips t WHERE t.title = 'Avoid night road travel' AND t.park_id = p.park_id);

INSERT INTO safety_tips (tip_id, park_id, title, content, category, priority, is_active)
SELECT gen_random_uuid(), p.park_id, 'Boda-boda caution',
  $$Motorcycle taxis often lack helmets and have mixed safety records. Visitors are advised to use arranged tourist transport instead.$$,
  'driving', 2, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM safety_tips t WHERE t.title = 'Boda-boda caution' AND t.park_id = p.park_id);

INSERT INTO safety_tips (tip_id, park_id, title, content, category, priority, is_active)
SELECT gen_random_uuid(), p.park_id, 'Hire a porter on steep treks',
  $$Porters carry heavy packs and help on steep climbs so you can focus on footing. Tell your guide early if you need one.$$,
  'general', 4, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM safety_tips t WHERE t.title = 'Hire a porter on steep treks' AND t.park_id = p.park_id);

INSERT INTO faqs (faq_id, park_id, question_en, answer_en, category, sort_order, is_published)
SELECT gen_random_uuid(), p.park_id,
  'Is yellow fever vaccination required for Bwindi?',
  $$Yes. Uganda requires yellow fever vaccination for entry. You may be asked to show your certificate on arrival. Consult a travel clinic several weeks before departure.$$,
  'staying_safe_health', 1, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM faqs f WHERE f.question_en = 'Is yellow fever vaccination required for Bwindi?');

INSERT INTO faqs (faq_id, park_id, question_en, answer_en, category, sort_order, is_published)
SELECT gen_random_uuid(), p.park_id,
  'How do I prevent malaria in Bwindi?',
  $$Take prescribed antimalarial medication, use DEET repellent, wear long sleeves at dawn and dusk, and sleep under treated mosquito nets. Most lodges provide nets.$$,
  'staying_safe_health', 2, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM faqs f WHERE f.question_en = 'How do I prevent malaria in Bwindi?');

INSERT INTO faqs (faq_id, park_id, question_en, answer_en, category, sort_order, is_published)
SELECT gen_random_uuid(), p.park_id,
  'Do I need travel insurance for gorilla trekking?',
  $$Comprehensive insurance with medical evacuation cover is strongly recommended. Serious injuries may require helicopter evacuation to Kampala or beyond.$$,
  'staying_safe_health', 3, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM faqs f WHERE f.question_en = 'Do I need travel insurance for gorilla trekking?');

INSERT INTO faqs (faq_id, park_id, question_en, answer_en, category, sort_order, is_published)
SELECT gen_random_uuid(), p.park_id,
  'How close can I get to mountain gorillas?',
  $$Maintain at least 7 meters (about 21 to 23 feet) from gorillas. If one approaches, stay calm, crouch slightly, and follow your ranger. Never approach without guide approval.$$,
  'staying_safe_trek', 1, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM faqs f WHERE f.question_en = 'How close can I get to mountain gorillas?');

INSERT INTO faqs (faq_id, park_id, question_en, answer_en, category, sort_order, is_published)
SELECT gen_random_uuid(), p.park_id,
  'Can I trek gorillas if I have a cold?',
  $$No. Visitors with contagious illnesses should not trek. Gorillas are vulnerable to human diseases. Inform rangers before the briefing if you feel unwell.$$,
  'staying_safe_trek', 2, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM faqs f WHERE f.question_en = 'Can I trek gorillas if I have a cold?');

INSERT INTO faqs (faq_id, park_id, question_en, answer_en, category, sort_order, is_published)
SELECT gen_random_uuid(), p.park_id,
  'What should I pack for Bwindi trekking?',
  $$Waterproof boots, rain jacket, long sleeves and trousers, warm layers, gloves, daypack, trekking poles, insect repellent, sunscreen, first-aid kit, and documents in a waterproof pouch.$$,
  'staying_safe_packing', 1, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM faqs f WHERE f.question_en = 'What should I pack for Bwindi trekking?');

INSERT INTO faqs (faq_id, park_id, question_en, answer_en, category, sort_order, is_published)
SELECT gen_random_uuid(), p.park_id,
  'How difficult are Bwindi hiking trails?',
  $$Trails are steep, muddy, and humid with elevation between roughly 1,160 m and 2,607 m. Fitness matters. Use poles, pace yourself, and stay with your guide.$$,
  'staying_safe_trek', 3, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM faqs f WHERE f.question_en = 'How difficult are Bwindi hiking trails?');

INSERT INTO faqs (faq_id, park_id, question_en, answer_en, category, sort_order, is_published)
SELECT gen_random_uuid(), p.park_id,
  'What if I encounter forest elephants?',
  $$Stay calm, keep a safe distance, and retreat slowly without turning your back. Never block their escape route. Follow your guide immediately.$$,
  'staying_safe_wildlife', 1, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM faqs f WHERE f.question_en = 'What if I encounter forest elephants?');

INSERT INTO faqs (faq_id, park_id, question_en, answer_en, category, sort_order, is_published)
SELECT gen_random_uuid(), p.park_id,
  'Is Uganda safe for tourists?',
  $$Uganda is generally hospitable. Petty theft is the most common issue. Be discreet with valuables, avoid walking alone at night in cities, and use reputable transport.$$,
  'staying_safe_travel', 1, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM faqs f WHERE f.question_en = 'Is Uganda safe for tourists?');

INSERT INTO faqs (faq_id, park_id, question_en, answer_en, category, sort_order, is_published)
SELECT gen_random_uuid(), p.park_id,
  'Why must I use a UWA guide in Bwindi?',
  $$Certified guides know safe routes, wildlife behaviour, emergency protocols, and local culture. They are your primary safety resource in the forest.$$,
  'staying_safe_trek', 4, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM faqs f WHERE f.question_en = 'Why must I use a UWA guide in Bwindi?');

INSERT INTO faqs (faq_id, park_id, question_en, answer_en, category, sort_order, is_published)
SELECT gen_random_uuid(), p.park_id,
  'Is it safe to drive at night in Uganda?',
  $$Night driving is discouraged. Roads can be poor and visibility limited. Plan to reach lodges before dark and use reputable operators for transfers.$$,
  'staying_safe_travel', 2, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM faqs f WHERE f.question_en = 'Is it safe to drive at night in Uganda?');

INSERT INTO destination_info (destinfo_id, park_id, category, title, content_en, sort_order, is_active, is_emergency)
SELECT gen_random_uuid(), p.park_id, 'health',
  'Pre-trip health checklist',
  $$Consult a travel clinic for yellow fever, malaria prophylaxis, and recommended vaccines (typhoid, hepatitis A and B, cholera). Drink bottled or filtered water. Avoid untreated natural swimming water.$$,
  10, true, false
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM destination_info d WHERE d.title = 'Pre-trip health checklist' AND d.park_id = p.park_id);

INSERT INTO destination_info (destinfo_id, park_id, category, title, content_en, sort_order, is_active, is_emergency)
SELECT gen_random_uuid(), p.park_id, 'facilities',
  'Packing: clothing essentials',
  $$Long sleeves and trousers, rain jacket, waterproof broken-in boots, warm layers for cool mornings, and sturdy gloves for steep vegetation.$$,
  20, true, false
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM destination_info d WHERE d.title = 'Packing: clothing essentials' AND d.park_id = p.park_id);

INSERT INTO destination_info (destinfo_id, park_id, category, title, content_en, sort_order, is_active, is_emergency)
SELECT gen_random_uuid(), p.park_id, 'facilities',
  'Packing: gear and equipment',
  $$Daypack with rain cover, trekking poles, headlamp, binoculars, and reusable water bottle. Hydration is critical on long forest days.$$,
  21, true, false
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM destination_info d WHERE d.title = 'Packing: gear and equipment' AND d.park_id = p.park_id);

INSERT INTO destination_info (destinfo_id, park_id, category, title, content_en, sort_order, is_active, is_emergency)
SELECT gen_random_uuid(), p.park_id, 'facilities',
  'Packing: personal care kit',
  $$DEET repellent, sunscreen, lip balm, first-aid supplies, and waterproof document pouch for passport, permits, and insurance.$$,
  22, true, false
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM destination_info d WHERE d.title = 'Packing: personal care kit' AND d.park_id = p.park_id);

INSERT INTO destination_info (destinfo_id, park_id, category, title, content_en, sort_order, is_active, is_emergency)
SELECT gen_random_uuid(), p.park_id, 'rules',
  'Forest trail safety',
  $$Stay on marked paths, use trekking poles, pace yourself, remain with your group, and start morning hikes when trails are firmer.$$,
  3, true, false
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM destination_info d WHERE d.title = 'Forest trail safety' AND d.park_id = p.park_id);

INSERT INTO destination_info (destinfo_id, park_id, category, title, content_en, sort_order, is_active, is_emergency)
SELECT gen_random_uuid(), p.park_id, 'transport',
  'Getting around Uganda safely',
  $$Use reputable tour operators for transfers. Avoid night driving. Boda-boda motorcycles and crowded matatus carry higher risk for visitors.$$,
  10, true, false
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM destination_info d WHERE d.title = 'Getting around Uganda safely' AND d.park_id = p.park_id);

INSERT INTO destination_info (destinfo_id, park_id, category, title, content_en, sort_order, is_active, is_emergency)
SELECT gen_random_uuid(), p.park_id, 'transport',
  'Kampala city precautions',
  $$Petty theft is more common in cities. Use a money belt, avoid walking alone after dark outside tourist areas, and keep valuables discreet.$$,
  11, true, false
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM destination_info d WHERE d.title = 'Kampala city precautions' AND d.park_id = p.park_id);

INSERT INTO destination_info (destinfo_id, park_id, category, title, content_en, sort_order, is_active, is_emergency)
SELECT gen_random_uuid(), p.park_id, 'emergency',
  'Medical evacuation awareness',
  $$Serious emergencies may require evacuation to Kampala or internationally. Carry insurance details and inform your guide immediately if injured or severely ill.$$,
  1, true, true
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM destination_info d WHERE d.title = 'Medical evacuation awareness' AND d.park_id = p.park_id);

INSERT INTO destination_info (destinfo_id, park_id, category, title, content_en, sort_order, is_active, is_emergency)
SELECT gen_random_uuid(), p.park_id, 'health',
  'Why UWA guides matter',
  $$Guides are trained in first aid, wildlife behaviour, navigation, and evacuation coordination. They are your primary safety resource in the forest.$$,
  11, true, false
FROM parks p WHERE p.name ILIKE '%Bwindi%'
  AND NOT EXISTS (SELECT 1 FROM destination_info d WHERE d.title = 'Why UWA guides matter' AND d.park_id = p.park_id);
