-- =====================================================================
-- Extended species narratives + guaranteed catalogue imagery (idempotent)
-- Run after 004 via backend/scripts/seed.js — avoid semicolons inside literals
-- =====================================================================

UPDATE animals SET
  description = 'Mountain gorillas (Gorilla beringei beringei) are the ecological and cultural flagship of Bwindi Impenetrable National Park and a cornerstone of its UNESCO World Heritage listing. Roughly half the world''s population lives in the Virunga–Bwindi highlands, where habituated groups follow daily paths through Afromontane forest between about 1,160 and 2,607 m. Before trekking, UWA briefings cover disease transmission risks, seven-metre viewing etiquette, what to do if a silverback displays, and why flash photography is banned. In the forest, trackers relay nest histories so guides can interpret family dynamics — silverback leadership, juvenile play, and maternal transfers — without crowding animals. Permit revenue funds anti-poaching patrols, veterinary care, and community benefit-sharing, so informed visitors strengthen the whole conservation chain.',
  image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/066_Silverback_mountain_gorilla_eating_at_Bwindi_Impenetrable_Forest_National_Park_Photo_by_Giles_Laurent.jpg/960px-066_Silverback_mountain_gorilla_eating_at_Bwindi_Impenetrable_Forest_National_Park_Photo_by_Giles_Laurent.jpg']
WHERE name = 'Mountain Gorilla';

UPDATE animals SET
  description = 'African forest elephants (Loxodonta cyclotis) are the rainforest form of Africa''s elephant lineage — smaller, rounder-eared, and tuned to dense Bwindi canopies than savanna Loxodonta africana. They engineer seed-dispersal and mineral-lick circuits along ridges and swampy bottoms, yet remain shy on tourist trails, so guides read snapped branches, fresh dung, and muddy shoulder prints more often than guests see whole herds. Rangers treat forest buffalo and elephant encounters with equal caution — never block escape routes, keep voices low, and follow retreat instructions. Understanding their role in fruiting-tree regeneration helps visitors see Bwindi as more than a gorilla-only destination.',
  image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/African_forest_elephant_%28Loxodonta_cyclotis%29_calf.jpg/960px-African_forest_elephant_%28Loxodonta_cyclotis%29_calf.jpg']
WHERE name = 'African Forest Elephant';

UPDATE animals SET
  description = 'Savanna elephants (Loxodonta africana) are the wide-ranging form most visitors picture from documentaries. Bwindi''s deeper forest is primarily shaped by forest elephants (Loxodonta cyclotis), but comparing ear shape, body size, and forest-edge behaviour helps interpret occasional historical records and regional ecology. This entry is retained for teaching contrasts — always defer to rangers when any elephant sign appears.',
  image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/African_elephants_%28Loxodonta_africana%29_in_water.jpg/960px-African_elephants_%28Loxodonta_africana%29_in_water.jpg']
WHERE name = 'African Elephant';

UPDATE animals SET
  description = 'The great blue turaco (Corythaeola cristata) is Africa''s largest turaco — a canopy heavyweight that glides between fruiting figs with heavy wingbeats and loud ''cow-cow'' calls. In Bwindi it signals healthy mid-storey fruit masts and seed-dispersal networks that gorillas, monkeys, and butterflies also exploit. Guides often locate birds by sound first, then point out yellow bill tips and cobalt wing panels against mossy branches. Responsible viewing means no playback harassment at nests, steady binocular use, and staying on marked lines so understory breeders are not trampled.',
  image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Great_Blue_Turaco.jpg/960px-Great_Blue_Turaco.jpg']
WHERE name = 'Great Blue Turaco';

UPDATE animals SET
  description = 'Chimpanzees (Pan troglodytes) persist at low densities across Bwindi''s higher slopes, leaving nests, knuckle prints, and pant-hoot choruses as field evidence more often than relaxed sightings. They are Endangered range-wide — disease risks from human proximity are taken seriously, so no feeding, no mimicking calls to lure individuals, and strict hygiene rules mirror gorilla protocols. Researchers track community boundaries and tool traditions, while guides explain how fruiting calendars and ridge corridors link chimp ranging to wider Albertine conservation planning.',
  image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/A_group_of_imp_chimps.jpg/960px-A_group_of_imp_chimps.jpg']
WHERE name = 'Chimpanzee';

UPDATE animals SET
  description = 'Black-and-white colobus (Colobus guereza) decorate the upper canopy with streaming white tails and acrobatic leaps between liana tangles. Specialized leaf fermentation in the gut lets them exploit fibrous foliage other monkeys skip, so healthy troops flag mature forest structure. Newborns appear startlingly white before the adult black cape grows in — a favourite interpretive moment for guides linking primate behaviour to trail pacing and noise discipline.',
  image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Black-and-white_Colobus_Monkeys.jpg/960px-Black-and-white_Colobus_Monkeys.jpg']
WHERE name = 'Black-and-white Colobus';

UPDATE animals SET
  description = 'The African fish eagle (Haliaeetus vocifer) ties Bwindi visitors to the broader Great Lakes soundscape — its whistled duets evoke lakeshores even when birds commute along forest-edge rivers. Fish, waterbirds, and carrion anchor its diet, while tall emergents provide command perches. Guides use it to discuss watershed health, pesticide runoff risks, and why riparian buffers matter for parks downstream of steep Bwindi catchments.',
  image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/African_fish_eagle_%28Haliaeetus_vocifer%29_with_fish.jpg/960px-African_fish_eagle_%28Haliaeetus_vocifer%29_with_fish.jpg']
WHERE name = 'African Fish Eagle';

UPDATE animals SET
  description = 'Rwenzori turacos (Ruwenzorornis johnstoni) flash ruby primaries when they flap between moss-forest crowns — an Albertine Rift endemic that anchors many ridge-top birding lists. Croaking duets carry through mist, so listening posts matter as much as optics. Guides pair sightings with elevation, bamboo transitions, and seasonal fruiting to explain micro-endemism without pressuring birds with excessive playback.',
  image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Ruwenzori_Turaco%2C_Rwenzori_National_Park%2C_Uganda.jpg/960px-Ruwenzori_Turaco%2C_Rwenzori_National_Park%2C_Uganda.jpg']
WHERE name = 'Rwenzori Turaco';

UPDATE animals SET
  description = 'L''Hoest''s monkeys (Allochrocebus lhoesti) are thick-furred, ground-foraging guenons of montane Central Africa — white rump flashes and horizontal posture give them away along bamboo-thicket edges. Quiet approach matters because stress can drive them into steep terrain. Guides connect their presence to intact understorey and predator networks from eagles to leopards.',
  image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/LHoests_monkey_%28Cercopithecus_lhoesti%29_captive.jpg/960px-LHoests_monkey_%28Cercopithecus_lhoesti%29_captive.jpg']
WHERE name = 'L''Hoest''s Monkey';

UPDATE animals SET
  description = 'Blue monkeys (Cercopithecus mitis) form mid-canopy troops that stitch fruit masts to insect pulses across Bwindi. Alarm barks coordinate escapes when crowned eagles or human noise spikes. Guides use them as indicators of canopy productivity and as teaching moments for keeping voices low so habituated gorilla groups are not disturbed downstream.',
  image_urls = ARRAY['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Zanzibar_Sykes%27_monkey_%28Cercopithecus_mitis%29_female_and_juveniles.jpg/960px-Zanzibar_Sykes%27_monkey_%28Cercopithecus_mitis%29_female_and_juveniles.jpg']
WHERE name = 'Blue Monkey';
