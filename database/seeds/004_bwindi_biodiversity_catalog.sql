-- =====================================================================
-- BWINDI BIODIVERSITY CATALOG (tour-guide species set)
-- Applied after 003_bwindi_extended_content.sql via backend/scripts/seed.js
-- Idempotent INSERT ... SELECT WHERE NOT EXISTS. Demo copy for SIGTS;
-- aligns with typical UWA / Albertine Rift interpretive lists (not exhaustive
-- of every forest insect). Wikimedia image URLs omit tracking query strings.
-- Do not use semicolons (;) inside SQL string literals in this file: seed.js splits
-- statements on semicolons after stripping line comments.
-- =====================================================================

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Olive Baboon', 'Papio anubis', 'Powerful forest-edge baboons sometimes encountered where Bwindi meets farmland. Rangers stress distance: never feed or corner them.', 'least_concern', 'Forest margins, valleys, regenerating clearings near Bwindi', 'Omnivore: fruit, roots, small animals', 'About 30 to 45 years', ARRAY['Strict viewing rules protect both troops and visitors', 'Males coordinate sentinel posts on ridges'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Papio_anubis.jpg/960px-Papio_anubis.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Olive Baboon');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Bushbuck', 'Tragelaphus scriptus', 'Shy spiral-horned antelope of thickets and stream lines. Guides read ear-flicks and white tail spots before guests spot the body.', 'least_concern', 'Riverine scrub, secondary growth, forest ecotones', 'Browser: leaves, shoots, fruit', 'About 12 to 16 years', ARRAY['Often active at dawn and dusk along gorilla approach trails', 'Solitary or paired — bark alarm carries through bamboo'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Tragelaphus_scriptus.jpg/960px-Tragelaphus_scriptus.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Bushbuck');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Handsome Francolin', 'Pternistis nobilis', 'Albertine endemic partridge-like bird: a soundtrack of moss-forest mornings. Guides imitate calls sparingly so pairs are not stressed.', 'vulnerable', 'Bamboo-fern understory, ridge crests roughly 2,200 to 3,000 m', 'Seeds, fruit, arthropods', 'Several years wild — longer in aviculture', ARRAY['Pairs duet across ravines before trekking groups arrive', 'Listed among flagship Albertine ground birds'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Handsome_spurfowl_%28Pternistis_nobilis%29.jpg/960px-Handsome_spurfowl_%28Pternistis_nobilis%29.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Handsome Francolin');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Yellow-backed Duiker', 'Cephalophus silvicultor', 'Heavy-bodied duiker with a bold dorsal stripe. Seed dispersal partner for large-fruited trees along elephant paths.', 'near_threatened', 'Interior forest, mineral licks, old logging gaps', 'Frugivore-browser', 'Roughly 10 to 12 years', ARRAY['Freezes before bolting, giving photographers one chance', 'Listed near-threatened continent-wide'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Cephalophus_silvicultor_154622618.jpg/960px-Cephalophus_silvicultor_154622618.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Yellow-backed Duiker');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Black-fronted Duiker', 'Cephalophus nigrifrons', 'Small orange-flanked duiker of Albertine understorey. Guides associate its sharp sneeze with dense Impatiens thickets.', 'least_concern', 'Undergrowth tangles, root buttresses, bamboo fringes', 'Fruit and browse', 'About 9 to 12 years', ARRAY['Territorial chip notes help trackers triangulate', 'Camera traps often capture it alone'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Cephalophus_nigrifrons.jpg/960px-Cephalophus_nigrifrons.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Black-fronted Duiker');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Peter''s Duiker', 'Cephalophus callipygus', 'Red forest duiker widespread in Central Africa — in Bwindi it threads narrow tunnels under climbers.', 'least_concern', 'Moist evergreen understorey', 'Fruit, fungi, flowers', 'About 10 years', ARRAY['Named for zoologist Wilhelm Peters', 'Leaves symmetrical hoof prints on muddy poles'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Peters_Duiker_%28Cephalophus_callipygus%29_from_behind%2C_Campo_Maan_National_Park.jpg/960px-Peters_Duiker_%28Cephalophus_callipygus%29_from_behind%2C_Campo_Maan_National_Park.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Peter''s Duiker');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Giant Forest Hog', 'Hylochoerus meinertzhageni', 'Massive pig of deep forest wallows. Sounders churn mud that later attracts butterflies for minerals.', 'least_concern', 'Swampy bottoms, root boles, trail junctions', 'Omnivore: roots, carrion, crops near edges', 'Up to roughly 18 years', ARRAY['Tusk wear reveals age classes', 'Guides downwind positioning avoids startling sounders'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/3/3b/Hylochoerus_meinertzhageni.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Giant Forest Hog');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Bushpig', 'Potamochoerus larvatus', 'Nocturnal bristly pig rooting along forest-farm edges. Rustles explain night sounds near bandas.', 'least_concern', 'Thickets, crop buffers, ravines', 'Omnivore', 'About 15 years', ARRAY['Striped juveniles look like tiny boars', 'Dogs and pigs do not mix: biosecurity matters'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/0/0e/Potamochoerus_larvatus_43594615.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Bushpig');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'African Leopard', 'Panthera pardus', 'Elusive top predator of Bwindi — tracks and scrapes confirm presence more often than sightings. Rangers remind guests that habituation targets gorillas, not cats.', 'vulnerable', 'Rocky outcrops, river gorges, bamboo brakes', 'Carnivore', '12 to 17 years typical', ARRAY['Mostly nocturnal along tourist corridors', 'Spotted coat breaks outline in dappled light'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Panthera_pardus_close_up.jpg/960px-Panthera_pardus_close_up.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'African Leopard');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'African Golden Cat', 'Caracal aurata', 'Mid-sized felid of tangled slopes — camera traps reveal more than daylight trekking does. Albertine populations are part of wider Central African conservation planning.', 'vulnerable', 'Mossy ridges, liana tangles, secondary forest', 'Carnivore: rodents, duikers, birds', 'Roughly 12 years', ARRAY['Melanistic morphs occur in deep forest', 'Listed vulnerable on the IUCN Red List'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Caracal_aurata_2.jpg/960px-Caracal_aurata_2.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'African Golden Cat');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'African Civet', 'Civettictis civetta', 'Solitary omnivore patrolling trails after dark. Musk glands historically traded — today it is a sign of intact nocturnal food webs.', 'least_concern', 'Forest-floor paths, coffee fringes', 'Omnivore', '15 to 20 years', ARRAY['White bands make eyeshine unmistakable', 'Helps control rodents near lodges'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/a/a2/Civettictis_civetta_11.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'African Civet');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Potto', 'Perodicticus ibeanus', 'Slow-moving nocturnal primate with a vice-like grip. Night walks (where permitted) may reveal eyeshine low in vines.', 'least_concern', 'Mid-storey vines, gaps near fruiting trees', 'Gum, fruit, insects', 'About 12 to 15 years', ARRAY['Neck vertebrae allow odd head posture', 'Does not leap — inching travel only'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Potto.jpg/960px-Potto.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Potto');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'African Forest Buffalo', 'Syncerus caffer nanus', 'Smaller reddish buffalo of closed canopy herds. Guides treat them with the same respect as savanna buffalo: never block escape routes.', 'near_threatened', 'Interior glades, wallows, ridge saddles', 'Grazer-browser', 'Roughly 18 to 22 years', ARRAY['Herds leave polished rubbing trees', 'Vocalisations carry surprisingly far in mist'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Syncerus_caffer_nanus_-_01.jpg/960px-Syncerus_caffer_nanus_-_01.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'African Forest Buffalo');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Bar-tailed Trogon', 'Apaloderma vittatum', 'Jewel-like trogon of mid-canopy: tail bars flash when it pivots on a horizontal perch. A favourite Albertine photo target.', 'least_concern', 'Mixed montane forest, fig crowns', 'Insectivore-frugivore', 'About 10 years', ARRAY['Male delivers food during nestling stage', 'Wing noise is muffled for stealth'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Bar-tailed_Trogon_%28Apaloderma_vittatum%29_%2845634509165%29.jpg/960px-Bar-tailed_Trogon_%28Apaloderma_vittatum%29_%2845634509165%29.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Bar-tailed Trogon');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Black-and-white-casqued Hornbill', 'Bycanistes subcylindricus', 'Huge hornbill whose wingbeats sound like steam locomotives in mist. Pairs seal females inside nest cavities for weeks.', 'least_concern', 'Canopy, strangling figs, ridgetops', 'Frugivore with small animal prey', '30 to 40 years in captivity', ARRAY['Casque amplifies territorial knocks', 'Disperses large-seeded trees gorillas also use'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Bycanistes_subcylindricus_-_Forst_-_01.jpg/960px-Bycanistes_subcylindricus_-_Forst_-_01.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Black-and-white-casqued Hornbill');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Crowned Eagle', 'Stephanoaetus coronatus', 'Forest eagle capable of taking monkeys — guides scan crowns for bulky nests. Its presence signals healthy prey chains.', 'near_threatened', 'Emergent trees above closed canopy', 'Carnivore', 'Roughly 15 to 20 years', ARRAY['Long incubation shared by sexes', 'Near-threatened from deforestation outside parks'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Stephanoaetus_coronatus.jpg/960px-Stephanoaetus_coronatus.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Crowned Eagle');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Ruwenzori Batis', 'Batis diops', 'Pied flycatcher-like pairs working mossy limbs. Albertine endemic easy to recognise once the black mask is pointed out.', 'least_concern', 'Montane forest mid-storey', 'Insectivore', 'About 8 years inferred', ARRAY['Male feeds incubating female', 'Often first endemic of the morning for birding groups'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Ruwenzori_Batis_RWD.jpg/960px-Ruwenzori_Batis_RWD.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Ruwenzori Batis');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Archer''s Robin-chat', 'Cossypha archeri', 'Rich-voiced robin-chat of tangled edges. Guides use its song as a cue that the group is entering older-growth pockets.', 'least_concern', 'Forest gaps, landslide scars, lodge gardens', 'Insectivore with fruit', 'Roughly 8 to 10 years', ARRAY['Mimics other species sparingly', 'Often hops on gorilla-tracking staging paths'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/2/2d/Archersrobinchat.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Archer''s Robin-chat');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Regal Sunbird', 'Cinnyris regius', 'Iridescent Albertine sunbird working flowering lobelias. Moulting males can look patchy but still dazzle in shafts of sun.', 'least_concern', 'Canopy blossoms, ridge heath ecotones', 'Nectar and small insects', '5 to 8 years typical passerine', ARRAY['Hover-gleans like a tiny hummingbird', 'Pairs defend rich nectar trees'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Regal_sunbird_%28Cinnyris_regius_regius%29_male_moulting.jpg/960px-Regal_sunbird_%28Cinnyris_regius_regius%29_male_moulting.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Regal Sunbird');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Montane Oriole', 'Oriolus percivali', 'Golden oriole of high forests — fluty whistles carry across valleys. Often in flowering crowns with sunbirds.', 'least_concern', 'Upper canopy, flowering trees', 'Insectivore-frugivore', 'About 8 to 11 years', ARRAY['Sexes differ subtly in tone', 'Photo from Rubanda near Bwindi buffer'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Oriolus_percivali_-_avocat_-_602207636.jpeg/960px-Oriolus_percivali_-_avocat_-_602207636.jpeg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Montane Oriole');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Strange Weaver', 'Ploceus alienus', 'Albertine endemic weaver with a peaked crown. Nests hang over streams where guides pause for water checks.', 'vulnerable', 'Riparian forest, bamboo fringes', 'Seed and insect', 'Several years', ARRAY['Colonial nests can resemble chandeliers', 'IUCN lists it vulnerable'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/8/85/Strange_weaver.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Strange Weaver');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Lagden''s Bush-Shrike', 'Malaconotus lagdeni', 'Heavy-billed shrike of vine tangles. Hearing it is easier than seeing it — guides pace playback ethically.', 'vulnerable', 'Liana forests, edge regrowth', 'Insectivore', 'Roughly 8 years', ARRAY['Historical plate shows massive bill', 'Vulnerable from habitat loss regionally'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/MalaconotusLagdeniKeulemans_%28cropped%29.jpg/960px-MalaconotusLagdeniKeulemans_%28cropped%29.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Lagden''s Bush-Shrike');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Chestnut-throated Apalis', 'Apalis porphyrolaema', 'Tiny restless warbler-allies in mixed flocks. Photo classic from Ruhija sector shows Bwindi context.', 'least_concern', 'Canopy flocks, flowering trees', 'Insectivore', '5 to 7 years', ARRAY['Tail-wagging reveals ID at distance', 'Often with sunbirds in blossom crowns'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/6/60/Chestnut_throated_apalis1.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Chestnut-throated Apalis');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Dusky Crimsonwing', 'Cryptospiza jacksoni', 'Albertine estrildid finch, companion story to Shelley''s crimsonwing in guide banter. Pairs stick to dark bamboo.', 'least_concern', 'Bamboo understorey, bracken ecotones', 'Small seeds', 'Several years', ARRAY['Less flamboyant than Shelley''s but more frequently heard', 'Often in mixed seedeater flocks'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Cryptospiza_jacksoni_2.jpg/960px-Cryptospiza_jacksoni_2.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Dusky Crimsonwing');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Mocker Swallowtail', 'Papilio dardanus', 'African swallowtail famous for female mimicry forms. Forest glades shimmer with their slow sailing flight.', 'least_concern', 'Sunflecks, riverine openings', 'Nectar — larvae on citrus relatives', 'Seasonal broods', ARRAY['Females mimic toxic models where subspecies overlap', 'Popular interpretive stop on butterfly walks'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Mocker_swallowtail_%28Papilio_dardanus_cenea%29_female_form_cenea_Maputo.jpg/960px-Mocker_swallowtail_%28Papilio_dardanus_cenea%29_female_form_cenea_Maputo.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Mocker Swallowtail');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT 'Johnston''s Chameleon', 'Trioceros johnstoni', 'Three-horned chameleon of Bwindi moss forest. Rangers ask guests not to touch: skin stress harms them quickly.', 'least_concern', 'Mid-level branches, trackside shrubs', 'Insectivore', 'Several years', ARRAY['Eyes swivel independently while hunting', 'Photographed in situ inside Bwindi (see credit on Commons)'], ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Camale%C3%B3n_%28Trioceros_johnstoni%29%2C_parque_nacional_de_la_Selva_Impenetrable_de_Bwindi%2C_Uganda%2C_2024-02-01%2C_DD_89.jpg/960px-Camale%C3%B3n_%28Trioceros_johnstoni%29%2C_parque_nacional_de_la_Selva_Impenetrable_de_Bwindi%2C_Uganda%2C_2024-02-01%2C_DD_89.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Johnston''s Chameleon');
