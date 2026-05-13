-- =====================================================================
-- Deep species enrichment for SIGTS (Bwindi interpretive catalogue)
-- Sources amalgamated from Wikimedia Commons file pages, Wikipedia
-- summaries, and range-wide mammal and bird ecology references
-- Facts checked for BINP Albertine montane rainforest visitor context only
-- No semicolons inside string literals — seed.js splits on semicolons
-- =====================================================================

UPDATE animals SET
  description = 'Mountain gorillas (Gorilla beringei beringei) are the eastern gorilla subspecies of the Virunga Massif and Bwindi montane rainforest. Roughly half the global population nests and feeds in BINP ridges between about 1,160 and 2,607 m elevation. Thick fur cushions cold nights dense herb layers supply daily grazing and adults show strong maternal care with long juvenile dependency.',
  habitat = 'Afromontane and bamboo-mosaic rainforest in southwestern Uganda principally Bwindi sectors Buhoma Ruhija Rushaga and Nkuringo',
  diet = 'Herbivore leafy plants stems bark fruit occasional ants and rotten wood',
  lifespan = 'About 35 to 40 years in the wild females often outlive males',
  average_size = 'Adult males 120 to 196 kg upright height near 160 cm females roughly half males mass',
  gestation_period = 'About 8.5 months single infant typical twining is rare',
  social_structure = 'Stable harem groups centred on one silverback with adult females offspring and drifting blackbacks',
  fun_facts = ARRAY[
    'IUCN recognises the taxon as Endangered Numbers have rebounded where community revenue and enforcement align',
    'DNA overlap with humans is often quoted near 98 percent emphasising disease transmission etiquette on trails',
    'Daily nest construction leaves glossy oval depressions trackers read to predict group movement',
    'Permit-funded monitoring links veterinary outreach with buffer livelihood investments'
  ],
  image_urls = ARRAY[
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/066_Silverback_mountain_gorilla_eating_at_Bwindi_Impenetrable_Forest_National_Park_Photo_by_Giles_Laurent.jpg/960px-066_Silverback_mountain_gorilla_eating_at_Bwindi_Impenetrable_Forest_National_Park_Photo_by_Giles_Laurent.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Susa_group%2C_mountain_gorilla.jpg/960px-Susa_group%2C_mountain_gorilla.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Mountain_Gorilla%2C_Bwindi%2C_Uganda_%2816372469599%29.jpg/960px-Mountain_Gorilla%2C_Bwindi%2C_Uganda_%2816372469599%29.jpg'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE name = 'Mountain Gorilla';

UPDATE animals SET
  description = 'African forest elephants (Loxodonta cyclotis) inhabit lowland and montane rainforest from West Africa through the Congo Basin into western Uganda corridors. Adults average lower shoulder heights than savanna elephants carry straighter tusks emerging early and specialise on fruit pulp seed dispersal and mineral soil geophagy. BINP herds are shy dusk-active and often inferred from seismic trails dung curls and buttressed rub trees rather than marquee tourist sightings.',
  habitat = 'Closed canopy ridges swampy bottoms and mineral seeps networked by elephant engineers across Bwindi matrix',
  diet = 'Frugivore-browser mixed fruits leaves bark salts from forest clearings',
  lifespan = 'Into the sixth decade for relaxed populations',
  average_size = 'Shoulder heights often near two metres mass commonly several tonnes less than bush elephants',
  gestation_period = 'About 22 months among the longest mammal pregnancies',
  social_structure = 'Matrilineal groups and fluid male associations unlike open savanna phalanxes',
  fun_facts = ARRAY[
    'IUCN presently lists African forest elephants as Endangered Population trend depends on ivory pressure and corridor width',
    'Low-frequency vocalisations cue coordinated movement through foggy saddles trackers sometimes feel feet before eyes see animals',
    'Seed-filled dung hotspots boost fig and balanites regeneration feeding gorillas and frugivorous birds downstream'
  ],
  image_urls = ARRAY[
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/African_forest_elephant_%28Loxodonta_cyclotis%29_calf.jpg/960px-African_forest_elephant_%28Loxodonta_cyclotis%29_calf.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Loxodontacyclotis.jpg/960px-Loxodontacyclotis.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Loxodonta_cyclotis%2C_Odzala-Kokoua_National_Park%2C_Republic_of_the_Congo_53146541.jpg/960px-Loxodonta_cyclotis%2C_Odzala-Kokoua_National_Park%2C_Republic_of_the_Congo_53146541.jpg'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE name = 'African Forest Elephant';

UPDATE animals SET
  description = 'Eastern common chimpanzees (Pan troglodytes schweinfurthii in Uganda landscapes) roam wide fruit-driven home ranges with fission fusion parties knuckle trekking and nightly arboreal nests. Bwindi groups occur at comparatively low densities so pant-hoot duets buttress prints smashed termite mound faces and peeled Marantaceae stems often outshine relaxed glassing hours. Infectious respiratory protocols mirror gorilla rules because phylogenetic closeness compounds zoonotic risk.',
  habitat = 'Upper montane and submontane fruiting ridges bamboo ecotones and steep ravines bordering gorilla CORE zones',
  diet = 'Omnivore ripe fruit terrestrial herbs honey meat from monkey hunting where culturally transmitted',
  lifespan = '40 plus years females prime through long interbirth intervals',
  average_size = 'Adults 40 to 60 kg limbs longer than gorillas with opposable thumbs for tool handling',
  gestation_period = 'Around eight months neonates carried ventrally then dorsally juveniles',
  social_structure = 'Multi male communities with alliances grooming clusters and dispersing adolescent females',
  fun_facts = ARRAY[
    'Each community transmits unique termite probes leaf sponges or nut smash techniques analogous to localized culture',
    'Ranging maps overlap gorilla provisioning areas so trackers coordinate radios to minimise stress stacking',
    'Vocal fingerprints let researchers census unseen parties beneath canopy noise'
  ],
  image_urls = ARRAY[
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/A_group_of_imp_chimps.jpg/960px-A_group_of_imp_chimps.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/015_Chimpanzee_at_Kibale_forest_National_Park_Photo_by_Giles_Laurent.jpg/960px-015_Chimpanzee_at_Kibale_forest_National_Park_Photo_by_Giles_Laurent.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Gombe_Stream_NP_Mutter_und_Kind.jpg/960px-Gombe_Stream_NP_Mutter_und_Kind.jpg'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE name = 'Chimpanzee';

UPDATE animals SET
  description = 'Mantled guerezas or black-and-white colobus monkeys (Colobus guereza) decorate BINP canopy with filament white tail pennants bouncing between liana chandeliers. Pseudoruminant foregut chambers ferment tough leaves unlocking niches slender monkeys exploit while silvered infants scramble along mothers bellies Guides quiet groups when crowned eagles or approaching trek lines spike cortisol.',
  habitat = 'Upper canopy along riverine figs laurel corridors and moss bearded ridges',
  diet = 'Folivore supplemented with buds flowers lichen sporadic soils for minerals',
  lifespan = 'Approaching two decades for wild females sentinel males trade off vigilance duties',
  average_size = 'Body near half metre head-tail far longer white plume flashes during leaps',
  gestation_period = 'Roughly six months uniformly white newborn darkens patchily within weeks',
  social_structure = 'One male multi female units overlapping home ranges audible through coughing chorus',
  fun_facts = ARRAY[
    'The reduced pollex is phylogenetic not injury giving the Greek kolob cut off etymology',
    'Leap distances exceed ten metres dissipating predator surprise through altitude gain',
    'Sympatric blues monkeys often travel below them forming mixed layer vigilance nets'
  ],
  image_urls = ARRAY[
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Black-and-white_Colobus_Monkeys.jpg/960px-Black-and-white_Colobus_Monkeys.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Guereza_Abisinio_%28Colobus_guereza%29%2C_parque_nacional_de_la_Selva_Impenetrable_de_Bwindi%2C_Uganda%2C_2024-02-02%2C_DD_01.jpg/960px-Guereza_Abisinio_%28Colobus_guereza%29%2C_parque_nacional_de_la_Selva_Impenetrable_de_Bwindi%2C_Uganda%2C_2024-02-02%2C_DD_01.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Eastern_black-and-white_colobus_%28Colobus_guereza_occidentalis%29_with_juvenile.jpg/960px-Eastern_black-and-white_colobus_%28Colobus_guereza_occidentalis%29_with_juvenile.jpg'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE name = 'Black-and-white Colobus';

UPDATE animals SET
  description = 'Diademed cercopithecines known as blues or Sykes monkeys (Cercopithecus mitis) stitch mid canopy fruit networks and orthopteran booms beneath colobus superhighways. White throat puffs throated booms synchronize troop retreats when goshawks stoop or hikers clatter trekking poles unnecessarily.',
  habitat = 'Mid storey mixed forest edges buffer gardens and crater lake string bogs bordering gorilla corridors',
  diet = 'Omnivore weighted to fruits seeds gum caterpillar pulses',
  lifespan = 'Two decades females philopatric males disperse sideways',
  average_size = 'Head-body near 55 cm tails longer than torso for arboreal braking',
  gestation_period = 'Five to six months single black coated infant clasped sideways',
  social_structure = 'Female ranks persist through coalitions migrant males audition before breeding',
  fun_facts = ARRAY[
    'Alloparenting distributes infant handling reducing kidnapping vulnerability',
    'Facial bristle flicks reinforce dominance without costly chases echoing loudly under canopy fog',
    'Mixed species bird waves sometimes cue insect flush they exploit gleaning gleaning gleaning manoeuvres'
  ],
  image_urls = ARRAY[
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Zanzibar_Sykes%27_monkey_%28Cercopithecus_mitis%29_female_and_juveniles.jpg/960px-Zanzibar_Sykes%27_monkey_%28Cercopithecus_mitis%29_female_and_juveniles.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/BlueMonkey.jpg/960px-BlueMonkey.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Cercopithecus_mitis_2023.jpg/960px-Cercopithecus_mitis_2023.jpg'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE name = 'Blue Monkey';

UPDATE animals SET
  description = 'L Hoest monkeys (Allochrocebus lhoesti) haunt bamboo skirt ecotones with white rump flashes against jet capes terrestrial foraging gait and explosive bounding when pressed. Thick pelage suits cold ridges above 2 000 m while omnivorous opportunism covers fungi caterpillars and terrestrial herbs between mast years Visitors encounter them often along boundary transects emphasizing quiet binocular discipline.',
  habitat = 'Steep southwestern montane blocks within or abutting BINP moss heath ribbons',
  diet = 'Fruit arthropods fungus herbs opportunistic terrestrial invertebrate digging',
  lifespan = 'Twenty plus years guarded social knowledge passes matrilocally',
  average_size = 'Males visibly robust near eight kilograms females slenderer both short tailed silhouette',
  gestation_period = 'Five to six months seasonal singleton peaks before heavy rains',
  social_structure = 'One male guarded harems offspring form natal playgrounds around bamboo brakes',
  fun_facts = ARRAY[
    'Terrestrial paw prints confuse trackers until white flash diagnostic tail flick emerges',
    'Historically tethered taxonomy debates align them with terrestrial guenon radiation',
    'Coffee buffer interfaces increase crop raid vigilance synergy with farmers compensation schemes'
  ],
  image_urls = ARRAY[
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/LHoests_monkey_%28Cercopithecus_lhoesti%29_captive.jpg/960px-LHoests_monkey_%28Cercopithecus_lhoesti%29_captive.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/LHoest_monkey_Allochrocebus_Lhoesti_male_%28cropped%29.jpg/960px-LHoest_monkey_Allochrocebus_Lhoesti_male_%28cropped%29.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/LHoests_monkey_CZ_Thumb.jpg/960px-LHoests_monkey_CZ_Thumb.jpg'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE name = 'L''Hoest''s Monkey';

UPDATE animals SET
  description = 'The great blue turaco (Corythaeola cristata) is Earth largest turaco heaving iridescent primaries cobalt wing panels and ketchup nictitating membranes glimpsed amid wild fig chandeliers. Vocal cowing advertises territorial fruit circuits while gut passage times broadcast fig seeds downhill towards gorilla foraging arenas.',
  habitat = 'Strata from subcanopy ladders to crowns within mixed moist montane evergreen forest patches',
  diet = 'Frugivore especially fig-family fruit occasional leaves and blossoms',
  lifespan = 'Decade plus pairs defend multi hectare auditory amphitheatres',
  average_size = 'Mass near kilogram seventy centimetres head tail stiff crest adds silhouette',
  gestation_period = 'Month long nestling cycles within platform nests of twigs',
  social_structure = 'Monogamous or cooperative breeders juveniles help upcoming clutches facultatively',
  fun_facts = ARRAY[
    'Turacin and turacoverdin pigments dissolve in alkaline solutions unique among birds',
    'Wing claps audible hundreds of metres through mist alerting guides before optics resolve colour',
    'Mutualistic seed dispersal stitching links primate nectar bats and gardeners of light gaps'
  ],
  image_urls = ARRAY[
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Great_Blue_Turaco.jpg/960px-Great_Blue_Turaco.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/017_Great_blue_turaco_at_Kibale_forest_National_Park_Photo_by_Giles_Laurent.jpg/960px-017_Great_blue_turaco_at_Kibale_forest_National_Park_Photo_by_Giles_Laurent.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Great_blue_turaco_%28Corythaeola_cristata%29.jpg/960px-Great_blue_turaco_%28Corythaeola_cristata%29.jpg'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE name = 'Great Blue Turaco';

UPDATE animals SET
  description = 'Rwenzori turaco (Ruwenzorornis johnstoni) is Albertine endemic flashing ruby primaries in moss forest mist croaking chuckles pacing bamboo transitions. Narrow elevational fidelity makes it emblematic ridge flagship easily taught after guides plot bamboo string altitudes GPS.',
  habitat = 'Moss laden crowns above circa 2100 metres through Afro alpine ecotone interfaces',
  diet = 'Fruit specialist especially parasol-tree drupes some leaf matter',
  lifespan = 'Poorly censused likely decade scale territory defence vocal',
  average_size = 'Mid turaco stature bright green mantle red wing windows under flight',
  gestation_period = 'Seasonal breeder cavity or platform adaptations vary by locality',
  social_structure = 'Pairs or family cliques maintain acoustic fiefdoms sunrise duets hallmark',
  fun_facts = ARRAY[
    'Johnston honours explorer Harry Johnston linking Victorian exploration lore to UNESCO storytelling',
    'Flight noise dampened feathers aid silent moss forest manoeuvres predator evasion tactic',
    'Pairs answer playback sparingly interpreters stress minimalist ethics protocols'
  ],
  image_urls = ARRAY[
    'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Ruwenzori_Turaco%2C_Rwenzori_National_Park%2C_Uganda.jpg/960px-Ruwenzori_Turaco%2C_Rwenzori_National_Park%2C_Uganda.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Ruwenzori_Turaco_-_surveying_the_forest.JPG/960px-Ruwenzori_Turaco_-_surveying_the_forest.JPG',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Ruwenzori_Turaco_-_leaping_from_tree_to_tree.JPG/960px-Ruwenzori_Turaco_-_leaping_from_tree_to_tree.JPG'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE name = 'Rwenzori Turaco';

UPDATE animals SET
  description = 'African fish eagle (Haliaeetus vocifer) couples sentinel dead snags overlooking forest rivers whose health ties Bwindi steep catchments to Great Lakes wetlands. Lunging dives snatch freshwater fish amphibians seldom water birds talon juggling secures slippery prey whistles sync breeding cycles with lake level pulses.',
  habitat = 'Emergent snag perches bridging interior streams and mahogany gallery swamps bordering park',
  diet = 'Piscivore opportunistic kleptos on reptiles chicks carrion when fish scarce',
  lifespan = 'Two decades pair bonds fiercely defend acoustic territories whistles carry kilometres',
  average_size = 'Wingspan two point four metre female heavier reverse sexual dimorphism raptor usual',
  gestation_period = 'Six week incubation clutches average two chicks siblicide sometimes moderates recruitment',
  social_structure = 'Long term monogamous cooperative fledging tandem fishing lessons',
  fun_facts = ARRAY[
    'National symbol for multiple nations emphasising wetland connectivity beyond forest boundary fences',
    'Light underwing crescents flare during stoops cueing hikers to glance upslope snag lines',
    'Ribbon lake migrations explain dawn flyovers audible before coffee at Buhoma ridges'
  ],
  image_urls = ARRAY[
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/African_fish_eagle_%28Haliaeetus_vocifer%29_with_fish.jpg/960px-African_fish_eagle_%28Haliaeetus_vocifer%29_with_fish.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/African_fish_eagle_%28Haliaeetus_vocifer%29_Ethiopia.jpg/960px-African_fish_eagle_%28Haliaeetus_vocifer%29_Ethiopia.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/African_fish_eagle_%28Haliaeetus_vocifer%29_on_nest.jpg/960px-African_fish_eagle_%28Haliaeetus_vocifer%29_on_nest.jpg'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE name = 'African Fish Eagle';

UPDATE animals SET
  description = 'Grauer broadbill or African green broadbill (Pseudocalyptomena graueri) is monotypic Eurylaimid tied to airy bryophytic crowns coughing nasal whistles audible before moss green plumage resolves. Narrow Albertine foothill distribution tags it vulnerable to climate shifts and nectar logging synergy.',
  habitat = 'High elevation fruit bursts within closed canopy ridges especially Ruhija mist belts',
  diet = 'Caterpillars cicadas katydids supple fruit pulp wide gape gleans',
  lifespan = 'Data thin managed care extrapolates near decade horizons',
  average_size = 'Chunky passerine reminiscent of rainforest puffbird silhouettes moss olive tones',
  gestation_period = 'Cup nest camouflage chicks brooded tight canopy darkness',
  social_structure = 'Pairs or solitary territory floaters audible countersinging under drizzle',
  fun_facts = ARRAY[
    'Grauer honours Belgian explorer Rudolf Grauer linking colonial specimen trails to ethical modern ecotourism',
    'Broad gape analogous to puffbirds accommodates large orthopterans other insectivores ignore',
    'Playback trials remain tightly regulated to avoid disrupting breeding secrecy'
  ],
  image_urls = ARRAY[
    'https://upload.wikimedia.org/wikipedia/commons/d/d2/Grauer%27s_broadbill_%28Pseudocalyptomena_graueri%29_01_%28cropped%29.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/PseudocalyptomenaGraueriKeulemans.jpg/960px-PseudocalyptomenaGraueriKeulemans.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Grauer-Broadbill-Range.JPG/960px-Grauer-Broadbill-Range.JPG'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE name = 'African Green Broadbill';

UPDATE animals SET
  description = 'Black bee eater (Merops gularis) haunts luminous edges sallying hymenoptera with cobalt beard flashes against velvet plumage perch recycling returns to hawking stations along gorilla trekking cut lines teaching respectful gap spacing from active nests tunnels.',
  habitat = 'Skylights riverine dunes landslide scars within mixed montane matrix',
  diet = 'Hymenopteran specialist snapping bees wasps gleaning gleaning hawk flights',
  lifespan = 'Similar meropid arcs near dozen years fidelity high when banks stable',
  average_size = 'Thirty centimetre slim coraciiform slightly decurved dagger bill bristles sensory',
  gestation_period = 'Colonial bank burrows two metre tunnels chick thermoregulation communal sentries',
  social_structure = 'Loose rookeries chatter synchronised hawk alerts ripple downslope ridges',
  fun_facts = ARRAY[
    'Giles Laurent Bwindi series documents wild individuals proving forest interior presence not only gallery fiction',
    'Bee venom mitigation involves specialized bill scraping behaviour researchers still unpicking',
    'Edge creation paradoxically boosts populations if pesticide drift controlled on adjacent farms'
  ],
  image_urls = ARRAY[
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Black_Bee-eater_%28Merops_gularis%29_Photo_by_Giles_Laurent.jpg/960px-Black_Bee-eater_%28Merops_gularis%29_Photo_by_Giles_Laurent.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Merops_gularis_australis%2C_Bwindi_Impenetrable_Forest%2C_Uganda_2.jpg/960px-Merops_gularis_australis%2C_Bwindi_Impenetrable_Forest%2C_Uganda_2.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/c/cf/Black_bee-eater_%28Merops_gularis%29_Semuliki_NP%2C_Uganda.jpg'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE name = 'Black Bee-eater';

UPDATE animals SET
  description = 'Johnston three horned chameleon (Trioceros johnstoni) slow stalks arthropods along Bwindi epiphyte curtains independent eye steering grants precision tongue projection dehydration risk means hands off interpretation only.',
  habitat = 'Shrub storey near trails bamboo gaps second growth light flecks moss cushions',
  diet = 'Insectivore katydids mantids flies ballistic tongue ballistic projection',
  lifespan = 'Several wild seasons captive husbandry lengthens timelines',
  average_size = 'Snout vent under twenty centimetres males elaborate rostral horns occipital spines ornate',
  gestation_period = 'Ovoviviparous or egg laying regional variation observe local expert guidance brochures',
  social_structure = 'Solitary fiercely territorial widening colour signalling stress heat maps',
  fun_facts = ARRAY[
    'Commons DD 89 Uganda file proves in situ BINP legitimacy for visitor education thumbnails',
    'Horns scale with hormonal cycles avoid touching keratin ridges oils degrade integument',
    'Morning solar tracking maximises ectothermic gain before midday mist returns'
  ],
  image_urls = ARRAY[
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Camale%C3%B3n_%28Trioceros_johnstoni%29%2C_parque_nacional_de_la_Selva_Impenetrable_de_Bwindi%2C_Uganda%2C_2024-02-01%2C_DD_89.jpg/960px-Camale%C3%B3n_%28Trioceros_johnstoni%29%2C_parque_nacional_de_la_Selva_Impenetrable_de_Bwindi%2C_Uganda%2C_2024-02-01%2C_DD_89.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Trioceros_johnstoni_24196791.jpg/960px-Trioceros_johnstoni_24196791.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Camale%C3%B3n_%28Trioceros_johnstoni%29%2C_parque_nacional_de_la_Selva_Impenetrable_de_Bwindi%2C_Uganda%2C_2024-02-01%2C_DD_90-91_FS.jpg/960px-Camale%C3%B3n_%28Trioceros_johnstoni%29%2C_parque_nacional_de_la_Selva_Impenetrable_de_Bwindi%2C_Uganda%2C_2024-02-01%2C_DD_90-91_FS.jpg'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE name = 'Johnston''s Chameleon';

UPDATE animals SET
  description = 'Handsome francolin (Pternistis nobilis) soundtracks BINP ridges with rusty duetting between bamboo heath grasses Albertine endemic status vulnerable underscores narrow elevational trapping climate shifts threaten thermometer species.',
  habitat = 'Grass fern ridges near 2300 metre contour moss seep springs',
  diet = 'Seeds arthropods tender shoots scratch diggings leaf litter archaeology',
  lifespan = 'Aviculture parallels suggest multi year wild fidelity studies ongoing',
  average_size = 'Compact galliform curled black breast bands white supercilium sharp',
  gestation_period = 'Ground scrape nests cryptic chicks precocial shadow parents',
  social_structure = 'Pair or family coveys flush uphill steep escape tactic confuses predators tourists both',
  fun_facts = ARRAY[
    'First light acoustics cue guides on trekking pace etiquette before gorilla microphones hot',
    'White spotted juveniles vanish visually against volcanic scree mimicry synergy',
    'Listed Vulnerable continental assessments emphasise synergy with Afro alpine restoration corridors'
  ],
  image_urls = ARRAY[
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Handsome_spurfowl_%28Pternistis_nobilis%29.jpg/960px-Handsome_spurfowl_%28Pternistis_nobilis%29.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Handsome_Francolin_P._nobilis_1908.jpg/960px-Handsome_Francolin_P._nobilis_1908.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Handsome_spurfowl_distribution_map.svg/960px-Handsome_spurfowl_distribution_map.svg.png'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE name = 'Handsome Francolin';

UPDATE animals SET
  description = 'Bar tailed trogon (Apaloderma vittatum) delivers jewel tonal gradients tail vermiculations flashing when pivoting sideways on horizontal perches sexually dimorphic palettes assist interpretive scavenger hunts for mixed flocks moving mosswards.',
  habitat = 'Mid canopy strata within fruiting laurels and beetle galleries',
  diet = 'Caterpillar specialist mixed fruit gleaning hawk hover snatches ancillary',
  lifespan = 'Decade extrapolation from temperate trogons cautious inference',
  average_size = 'Twenty eight centimetre compact trogon squared tail underside barred diagnostic',
  gestation_period = 'Nest cavity refurbishment woodpecker holes recycled breeding lease',
  social_structure = 'Territorial males feed incubating mates courtship moth deliveries iconic',
  fun_facts = ARRAY[
    'Silenced wing beats aid ambush analogous to owl flight noise suppression different feather math',
    'Montane Malawi populations share plumage palettes helpful photographic white balance teaching',
    'Guides discourage flash because iridescent barbules blow highlights histograms worthless'
  ],
  image_urls = ARRAY[
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Bar-tailed_Trogon_%28Apaloderma_vittatum%29_%2845634509165%29.jpg/960px-Bar-tailed_Trogon_%28Apaloderma_vittatum%29_%2845634509165%29.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Apaloderma_vittatum_43581623.jpg/960px-Apaloderma_vittatum_43581623.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/d/df/Bartailedtrogon.jpg'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE name = 'Bar-tailed Trogon';
