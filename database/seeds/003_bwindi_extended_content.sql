-- =====================================================================
-- BWINDI EXTENDED CONTENT (idempotent merges)
-- Invoked automatically from backend/scripts/seed.js after base animals insert.
-- Content distilled from UNESCO 682 summaries, BirdLife site briefs / Albertine
-- Rift endemism narratives, common UWA trekking guidance; demo quality only.
-- =====================================================================

UPDATE animals SET
  description = 'Mountain gorillas (eastern gorilla subspecies) are Bwindi''s headline species and a global conservation emblem. Guided habituated groups attract regulated trekking. Visitors must keep distance and follow ranger instructions.',
  habitat = 'Afromontane and montane rainforest in Bwindi (roughly 1,160 to 2,607 m), dense undergrowth',
  conservation_status = 'endangered',
  image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/066_Silverback_mountain_gorilla_eating_at_Bwindi_Impenetrable_Forest_National_Park_Photo_by_Giles_Laurent.jpg/960px-066_Silverback_mountain_gorilla_eating_at_Bwindi_Impenetrable_Forest_National_Park_Photo_by_Giles_Laurent.jpg']
WHERE name = 'Mountain Gorilla';

UPDATE animals SET
  name = 'African Forest Elephant',
  scientific_name = 'Loxodonta cyclotis',
  description = 'Smaller-bodied than savanna elephants, forest elephants braid seed-dispersal corridors through montane rainforest. In Bwindi they are shy and scarce on trail networks. Guides listen for snapping branches miles ahead.',
  habitat = 'Interior forest corridors, swampy bottoms, ridges with mineral licks inside Bwindi',
  conservation_status = 'endangered',
  image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/African_forest_elephant_%28Loxodonta_cyclotis%29_calf.jpg/960px-African_forest_elephant_%28Loxodonta_cyclotis%29_calf.jpg']
WHERE name = 'African Elephant';

UPDATE animals SET
  description = 'The fish-eagle breeds near lakes and large rivers rather than dense interior forest, but overlapping bird communities connect Bwindi to regional waterways. Its piercing call is beloved across East Africa.',
  habitat = 'Lakeshore and river corridors near forest edges',
  conservation_status = 'least_concern',
  image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/AfricanFishEagle.jpeg/960px-AfricanFishEagle.jpeg']
WHERE name = 'African Fish Eagle';

UPDATE animals SET
  description = 'The great blue turaco is a heavyweight fruit eater of tall forest canopy. Loud calls and flashy wings reveal its presence before you spot the bird.',
  habitat = 'Canopy layers of evergreen and bamboo-mixed montane forest',
  conservation_status = 'least_concern',
  image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Great_Blue_Turaco.jpg/960px-Great_Blue_Turaco.jpg']
WHERE name = 'Great Blue Turaco';

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT
  'L''Hoest''s Monkey',
  'Allochrocebus lhoesti',
  'A terrestrial, thick-furred cercopithecid typical of mountainous Central African forests. Quiet groups weave through bamboo and brush. White rump flash is distinctive.',
  'vulnerable',
  'Bamboo-thicket edges, secondary forest patches in montane rainforest',
  'Omnivore: fruit, arthropods, occasional prey',
  'About 18 to 28 years wild',
  ARRAY['Often called ''forest guenons'' adapted to slopes', 'Males give low contact grunts'],
  ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/LHoests_monkey_%28Cercopithecus_lhoesti%29_captive.jpg/960px-LHoests_monkey_%28Cercopithecus_lhoesti%29_captive.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'L''Hoest''s Monkey');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT
  'Blue Monkey',
  'Cercopithecus mitis',
  'A canopy-oriented monkey pairing that forms loud, mobile troops. In Bwindi they signal the health of mid-canopy fruits and insects.',
  'least_concern',
  'Mid-canopy in mixed montane forest',
  'Omnivore (fruit-heavy with leaves and insects)',
  'Estimated 18 to 25 years',
  ARRAY['Also called Sykes'' monkey regionally', 'Youngsters stay close to shrubs while adults scan from above'],
  ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Zanzibar_Sykes%27_monkey_%28Cercopithecus_mitis%29_female_and_juveniles.jpg/960px-Zanzibar_Sykes%27_monkey_%28Cercopithecus_mitis%29_female_and_juveniles.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Blue Monkey');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT
  'Black-and-white Colobus',
  'Colobus guereza',
  'Ghost-white tail streamers advertise treetop leaps. Leaves dominate their diet thanks to gut microbes that ferment fibrous fodder.',
  'least_concern',
  'Upper canopy strata of riparian and mixed forest',
  'Folivore: leaves, flowers, bark by season',
  'Roughly 20 years',
  ARRAY['Young are born pure white. Black adult pattern grows in.', 'Name ''colobus'' references shortened thumb'],
  ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Black-and-white_Colobus_Monkeys.jpg/960px-Black-and-white_Colobus_Monkeys.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Black-and-white Colobus');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT
  'Chimpanzee',
  'Pan troglodytes',
  'Chimpanzees live at low densities in Bwindi. Wide-ranging nests and pant-hoot choruses testify to persistence. Genetic research reinforces their endangered status continent-wide.',
  'endangered',
  'Higher slopes, ridges, valleys with plentiful fruit mast years',
  'Omnivore: fruit and leaves, meat when available',
  'Up to roughly 35 to 45 years recorded',
  ARRAY['Individuals fashion tools for termite fishing where terrain allows', 'Each community has culturally distinct grooming habits'],
  ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/A_group_of_imp_chimps.jpg/960px-A_group_of_imp_chimps.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Chimpanzee');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT
  'Rwenzori Turaco',
  'Ruwenzorornis johnstoni',
  'Albertine Rift endemic with bottle-green plumage edged ruby. Its croaking choruses ripple through dripping montane ridges.',
  'least_concern',
  'Moss-heath and mixed montane canopies (>2,100 m ridges typical)',
  'Frugivore with seasonal leaf supplementation',
  'About 15 years in managed care extrapolated',
  ARRAY['Feeds on parasol-tree fruits tracked by birding guides', 'Wing feathers flash crimson mid-flight'],
  ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Ruwenzori_Turaco.jpg/960px-Ruwenzori_Turaco.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Rwenzori Turaco');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT
  'Black Bee-eater',
  'Merops gularis',
  'A velvety black insect hawk of forest edges. It sallies after bees and wasps, returning to the same favoured perch holes.',
  'least_concern',
  'Light gaps along tracks, ridges, disturbed edges near interior forest',
  'Insectivore (hymenoptera specialists)',
  'Around 12 years referenced for bee-eaters',
  ARRAY['Nests tunnels in earthy banks monitored by ranger teams during road maintenance', 'Vivid cobalt throat glows against shadow'],
  ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Black_Bee-eater_%28Merops_gularis%29_Photo_by_Giles_Laurent.jpg/960px-Black_Bee-eater_%28Merops_gularis%29_Photo_by_Giles_Laurent.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Black Bee-eater');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT
  'African Green Broadbill',
  'Pseudocalyptomena graueri',
  'A chunky Albertine endemic still tied to mossy crowns and canopy fruiting events. Twitchers cherish its nasal whistle drifting through dripping forest.',
  'vulnerable',
  'Mid-upper storey of mature montane forest with heavy epiphytes',
  'Mixed frugivore-insectivore',
  'Wild lifespan poorly documented in demos',
  ARRAY['Feeds quietly using wide gape gleaning', 'Range spans both sides of western Rift crest with micro-endemism'],
  ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/African_Green_Broadbill.jpg/960px-African_Green_Broadbill.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'African Green Broadbill');

-- --- Additional taxa explicitly highlighted in UNESCO dossier 682 (criterion x synthesis) ---

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT
  'Shelley''s Crimsonwing',
  'Cryptospiza shelleyi',
  'A striking seed-eating finch of dark understory tangles. Mentioned in UNESCO''s Bwindi dossier as among the forest''s notable Albertine-threatened birds, ideal for quiet moss-forest listening sessions with guides.',
  'endangered',
  'Bamboo understory ecotones between 1,800 to 2,400 m with heavy fruiting shrubs',
  'Granivore / fruit',
  'Long-lived in captivity. Wild span poorly known.',
  ARRAY['Bright crimson flank panels flush when pairs reunite', 'Pairs stay low, so bring patience and binocular stability'],
  ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Cryptospiza_shelleyi.jpg/960px-Cryptospiza_shelleyi.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Shelley''s Crimsonwing');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT
  'Chapin''s Flycatcher',
  'Fraseria lendu',
  'Rare flycatcher associated with humid interior canopy pockets. Listed among Bwindi''s emblematic passerines within the Albertine endemic complex highlighted on the World Heritage citation.',
  'endangered',
  'Lower-to-mid canopy along ridge-top forest with high humidity',
  'Insectivore (sallying for airborne prey)',
  'Territories span multiple seasons (refs vary)',
  ARRAY['Easiest cue is repeated soft chip notes post-dawn', 'Pairs defend fruiting corridors seasonally'],
  ARRAY['https://upload.wikimedia.org/wikipedia/commons/4/44/Chapin%27s_Flycatcher_%28Muscicapa_lendu%29_JM.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Chapin''s Flycatcher');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT
  'Turner''s Eremomela',
  'Eremomela turneri',
  'Tiny canopy sprite whose range hugs Albertine ridges. Featured in dossier summaries on extraordinary passerine complements inside Bwindi''s stratified habitats.',
  'endangered',
  'Upper canopy sprays and blossom-heavy edges',
  'Insectivore / nectar opportunist',
  'Typical passerine lifespan ~4 to 8 years inferred',
  ARRAY['Feeds in mixed flocks alongside sunbirds near flowering trees', 'Easy to overlook, so listen before looking'],
  ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Range_Turner%27s_eremomela.png/960px-Range_Turner%27s_eremomela.png']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Turner''s Eremomela');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT
  'Grauer''s Swamp Warbler',
  'Bradypterus grandis',
  'Dense wetland-edge skulker bordering montane sponges inside the forest matrix. Listed among emblematic passerines signalling Bwindi''s species-rich Albertine wetland ecotones (UNESCO 682 narrative).',
  'endangered',
  'Montane swamp fringes with sedges inside closed canopy bays',
  'Insectivore gleaning arthropods in rank growth',
  'Limited data. Can live many years in captivity.',
  ARRAY['Responds softly to imitation pishes. Guides avoid overuse.', 'Requires boardwalk etiquette to protect bog soils'],
  ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Bradypterus_grandis_-_bureaubenjamin_-_119616564.jpeg/960px-Bradypterus_grandis_-_bureaubenjamin_-_119616564.jpeg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Grauer''s Swamp Warbler');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT
  'African Giant Swallowtail',
  'Papilio antimachus',
  'Broad-winged swallowtail drifting along interior glades: the ''giant'' of continental Papilio fauna. UNESCO text stresses Bwindi''s standout lepidopteran richness. This species embodies showy canopy crossings near light gaps.',
  'vulnerable',
  'Riverine clearings and sunflecks along gorilla-tracking buffers',
  'Nectar and mineral uptake along damp sand',
  'Seasonal flight periods while hosts fruit',
  ARRAY['♂ aerial dogfights over ridge-line thermals amaze trekkers who pause mid-trail', 'Host-plants sensitise, so stay on ranger lines'],
  ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Papilio_antimachus.jpg/640px-Papilio_antimachus.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'African Giant Swallowtail');

INSERT INTO animals (name, scientific_name, description, conservation_status, habitat, diet, lifespan, fun_facts, image_urls)
SELECT
  'Cream-banded Swallowtail',
  'Papilio leucotaenia',
  'Flagship cream-banded patterning advertises toxicity trade-offs mid-canopy. Dossiers tie Bwindi to outstanding butterfly tallies, including numerous Albertine endemics, for interpretive trekking modules.',
  'near_threatened',
  'Mature forest corridors with Piperaceous larval hosts',
  'Larvae on vines. Nectar at forest edge.',
  'Several broods during wet pulses',
  ARRAY['Courtship arcs highlight UV bands unseen to many predators', 'Photographers cooperate with pacing groups to minimise flash stress'],
  ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/RebelAnnalendkkNaturhof1914TafXVII.jpg/960px-RebelAnnalendkkNaturhof1914TafXVII.jpg']
WHERE NOT EXISTS (SELECT 1 FROM animals WHERE name = 'Cream-banded Swallowtail');

-- Refresh media (and Chapin taxonomy) when rows already exist from an older seed pass
UPDATE animals SET image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Cryptospiza_shelleyi.jpg/960px-Cryptospiza_shelleyi.jpg'] WHERE name = 'Shelley''s Crimsonwing';
UPDATE animals SET scientific_name = 'Fraseria lendu', image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/4/44/Chapin%27s_Flycatcher_%28Muscicapa_lendu%29_JM.jpg'] WHERE name = 'Chapin''s Flycatcher';
-- No free-licence Turner's Eremomela portrait on Commons; range map is species-accurate.
UPDATE animals SET image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Range_Turner%27s_eremomela.png/960px-Range_Turner%27s_eremomela.png'] WHERE name = 'Turner''s Eremomela';
UPDATE animals SET image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Bradypterus_grandis_-_bureaubenjamin_-_119616564.jpeg/960px-Bradypterus_grandis_-_bureaubenjamin_-_119616564.jpeg'] WHERE name = 'Grauer''s Swamp Warbler';
UPDATE animals SET image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/RebelAnnalendkkNaturhof1914TafXVII.jpg/960px-RebelAnnalendkkNaturhof1914TafXVII.jpg'] WHERE name = 'Cream-banded Swallowtail';

INSERT INTO cultural_narratives (
    title_en, title_local, narrative_en, storyteller_name, community, story_type,
    cultural_significance, duration, verified_by_community, published_at,
    image_urls
)
SELECT
    'Walking softly with Batwa elders',
    'Okutambula n''abakuru b''Abatwa',
    'Before Bwindi became a national park and UNESCO World Heritage site, Batwa hunter-gatherer families traced every ravine between giant trees. Trails were memory maps stitched with plant names only spoken seasonally: bitter roots for rain months, sweeter fruits when warm winds slid up the ridges. Visiting today is intentionally slower: batons tap ahead to warn duikers while guides translate old names for ridges that now echo with tourists'' cameras.',
    'Jovia Katushabe',
    'batwa',
    'tradition',
    'Emphasizes cultural continuity beside strict conservation mandates and equitable benefit sharing programmes.',
    12,
    true,
    NOW(),
    ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Bwindi_children.jpg/960px-Bwindi_children.jpg']
WHERE NOT EXISTS (SELECT 1 FROM cultural_narratives WHERE title_en = 'Walking softly with Batwa elders');

INSERT INTO cultural_narratives (
    title_en, narrative_en, storyteller_name, community, story_type,
    cultural_significance, duration, verified_by_community, published_at,
    image_urls
)
SELECT
    'Tea steam on Bakiga ridges',
    'The Bakiga homesteads sprinkled above Buhoma brewed millet whilst listening for hornbills at dawn. Children learned that forest boundary markers were woven hop vines, never wire. When trekking groups arrive now, homestead fires still coax sweet tea scents downslope toward visitor centres reminders that coexistence narratives predate laminated trail maps.',
    'Denis Kahangi',
    'bakiga',
    'history',
    'Links agricultural livelihood timelines with gorilla-ready buffer zones regulated through UWA collaboration.',
    9,
    true,
    NOW(),
    ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Bamboo_Trail_Bwindi_Forest_-_panoramio_%281%29.jpg/960px-Bamboo_Trail_Bwindi_Forest_-_panoramio_%281%29.jpg']
WHERE NOT EXISTS (SELECT 1 FROM cultural_narratives WHERE title_en = 'Tea steam on Bakiga ridges');

INSERT INTO cultural_narratives (
    title_en, narrative_en, storyteller_name, community, story_type,
    cultural_significance, duration, verified_by_community, published_at,
    image_urls
)
SELECT
    'Proverb on listening before you tread',
    'Guides whisper: silence is etiquette so wildlife can choose crossings before hikers arrive. Patience earns safer encounters, from thrushes flushing ahead to colobus picking perches untouched.',
    'Mary Turyatemba',
    'other',
    'proverb',
    'Encourages etiquette mirroring ranger briefings.',
    4,
    true,
    NOW(),
    ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Bamboo_Trail_Bwindi_Forest.jpg/960px-Bamboo_Trail_Bwindi_Forest.jpg']
WHERE NOT EXISTS (SELECT 1 FROM cultural_narratives WHERE title_en = 'Proverb on listening before you tread');
