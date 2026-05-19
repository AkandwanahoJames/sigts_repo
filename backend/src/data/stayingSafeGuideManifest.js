/**
 * Full Bwindi "Staying Safe" travel guide — structured for SIGTS Info tab & offline packs.
 * @see https://www.bwindiimpenetrablenationalpark.com/travel-guide/staying-safe/
 */

const SOURCE_URL = 'https://www.bwindiimpenetrablenationalpark.com/travel-guide/staying-safe/';

const RECAP_ITEMS = [
    {
        title: 'Plan ahead',
        detail: 'Research the park, secure gorilla permits, and prepare your body for steep forest trekking.'
    },
    {
        title: 'Stay healthy',
        detail: 'Prioritise vaccinations, malaria prevention, and hydration. Address health concerns before travel.'
    },
    {
        title: 'Follow the rules',
        detail: 'Respect wildlife protocols, stay with your UWA guide, and follow park regulations at all times.'
    },
    {
        title: 'Pack thoughtfully',
        detail: 'Bring waterproof boots, rain gear, insect repellent, layers, and a personal first-aid kit.'
    },
    {
        title: 'Trust local experts',
        detail: 'Certified guides and porters navigate terrain, wildlife, and emergencies — rely on them in the forest.'
    }
];

const PACKING = {
    clothing: [
        'Long-sleeved shirts and trousers — insect bites, sun, and vegetation scratches',
        'High-quality rain jacket or poncho — sudden downpours are common year-round',
        'Waterproof, broken-in trekking boots with grip for steep muddy trails',
        'Warm layers for cool mornings and evenings at altitude',
        'Lightweight sturdy gloves for vegetation and trekking poles on steep climbs'
    ],
    gear: [
        'Daypack with rain cover for water, snacks, and extra layers',
        'Trekking poles for balance on uneven or slippery trails',
        'Headlamp or flashlight for dawn treks and remote lodge outages',
        'Binoculars for birdwatching and distant wildlife',
        'Reusable insulated water bottle — hydration is essential'
    ],
    personal_care: [
        'Insect repellent with DEET or another effective agent',
        'Sunscreen and lip balm — UV is strong even under canopy',
        'First-aid kit: bandages, antiseptic, pain relievers, antihistamines, blister care',
        'Waterproof pouch for passport, vaccination records, permits, and insurance'
    ]
};

const SECTIONS = [
    {
        id: 'health_prep',
        title: 'Health preparations before your trip',
        icon: 'shield',
        summary:
            'Bwindi’s remote rainforest exposes visitors to health risks uncommon elsewhere. Preparation before you fly lets you focus on the trek.',
        bullets: [
            'Consult a travel-health clinician several weeks before departure',
            'Carry proof of required vaccinations and permit paperwork in a waterproof pouch',
            'Discuss malaria prophylaxis, altitude tolerance, and any chronic conditions'
        ]
    },
    {
        id: 'vaccinations',
        title: 'Vaccinations and health precautions',
        icon: 'note',
        summary: 'Uganda requires or recommends specific immunisations for visitors to forest parks like Bwindi.',
        bullets: [
            'Yellow fever: mandatory for entry — carry your vaccination certificate',
            'Malaria: prevalent in the region — take prescribed antimalarials plus bite prevention',
            'Typhoid, Hepatitis A and B, Cholera: recommended — drink bottled or filtered water only',
            'COVID-19: check current Uganda entry rules before you travel'
        ]
    },
    {
        id: 'malaria',
        title: 'Malaria prevention',
        icon: 'rain',
        summary: 'Bwindi lies in a malaria-prone zone, especially during rainy seasons.',
        bullets: [
            'Use DEET-based repellent on exposed skin mornings and evenings',
            'Wear long sleeves and trousers — sleep under treated nets (most lodges provide them)',
            'Start antimalarial medication as directed — before arrival through after departure'
        ]
    },
    {
        id: 'altitude_fitness',
        title: 'Altitude and fitness',
        icon: 'map',
        summary: 'Elevation ranges from about 1,160 m to 2,607 m across steep, humid forest.',
        bullets: [
            'Assess fitness honestly — treks can last hours on muddy slopes',
            'Altitude sickness is rare but stay hydrated and pace ascents',
            'Train with hill walks and broken-in boots before your safari'
        ]
    },
    {
        id: 'insurance',
        title: 'Travel insurance',
        icon: 'phone',
        summary: 'Remote terrain limits quick access to advanced hospitals.',
        bullets: [
            'Choose cover that includes trekking, medical evacuation, and trip interruption',
            'Confirm helicopter evacuation is included for serious injury or illness',
            'Keep insurer emergency numbers offline in your pack'
        ]
    },
    {
        id: 'gorilla_trek',
        title: 'Staying safe during gorilla trekking',
        icon: 'paw',
        summary: 'Treks are always led by experienced UWA rangers who know gorilla behaviour and forest navigation.',
        bullets: [
            'Keep at least 7 m (about 21–23 ft) from gorillas to limit disease spread and stress',
            'Listen to ranger briefings and follow instructions in the forest',
            'Move slowly — avoid loud noises and prolonged direct eye contact',
            'If a gorilla approaches, stay calm, crouch slightly, and avoid sudden movement',
            'Do not trek if you feel unwell — human colds can harm gorillas'
        ]
    },
    {
        id: 'emergency',
        title: 'Emergency and health facilities',
        icon: 'phone',
        summary: 'Small clinics exist in gateway towns — serious cases may require evacuation to Kampala or abroad.',
        bullets: [
            'Comprehensive travel insurance with evacuation cover is strongly recommended',
            'Carry a basic first-aid kit even though guides carry essentials',
            'Report injury or illness to your guide immediately — they coordinate rescue protocols'
        ]
    },
    {
        id: 'personal_security',
        title: 'Staying safe in Uganda and Bwindi',
        icon: 'shield',
        summary: 'Uganda is generally hospitable — opportunistic petty theft is the most common issue visitors face.',
        bullets: [
            'Do not display expensive watches, cameras, or phones openly in crowds',
            'Avoid flashing large amounts of cash in markets',
            'Respect local communities — modest behaviour builds trust on cultural visits'
        ]
    },
    {
        id: 'wildlife_other',
        title: 'Other wildlife on the trail',
        icon: 'paw',
        summary: 'Beyond gorillas, forest elephants, primates, antelope, snakes, and insects share the trails.',
        bullets: [
            'Forest elephants: stay calm, keep distance, retreat slowly without turning your back',
            'Monkeys and primates: never feed or touch — aggression follows harassment',
            'Snakes and insects: wear protective boots and stay on designated paths only'
        ]
    },
    {
        id: 'hiking_terrain',
        title: 'Understanding Bwindi terrain',
        icon: 'map',
        summary: 'Steep ridges, valleys, and thick vegetation earn the park its “impenetrable” name.',
        bullets: [
            'Trails are often wet, slippery, and physically demanding',
            'Elevation shifts between roughly 1,160 m and 2,607 m on longer routes',
            'Weather and sector choice change difficulty — confirm with your operator'
        ]
    },
    {
        id: 'hiking_trails',
        title: 'Trail safety tips',
        icon: 'target',
        summary: 'Proper pacing and group discipline prevent most trail incidents.',
        bullets: [
            'Stay on marked paths — straying increases lost-person and wildlife risks',
            'Use trekking poles on steep or muddy sections',
            'Pace yourself — take breaks to avoid overexertion at altitude',
            'Never leave your guide or group'
        ]
    },
    {
        id: 'hiking_weather',
        title: 'Weather on the trail',
        icon: 'rain',
        summary: 'Tropical rainforest climate means rain is possible any month.',
        bullets: [
            'Waterproof boots with excellent grip are essential',
            'Carry a lightweight rain jacket or poncho',
            'Morning starts are often safer before prolonged rain softens paths'
        ]
    },
    {
        id: 'fatigue',
        title: 'Fatigue, injury, and porters',
        icon: 'info',
        summary: 'Speak up early if you struggle — guides can adjust pace or route.',
        bullets: [
            'Tell your guide immediately if you feel unwell or too tired to continue',
            'Hire a porter to carry heavy daypacks on steep sectors',
            'Treat blisters and minor cuts promptly to avoid infection in humid forest'
        ]
    },
    {
        id: 'guides',
        title: 'Why guides are your best safety resource',
        icon: 'book',
        summary: 'UWA-certified guides combine navigation, wildlife expertise, culture, and emergency training.',
        bullets: [
            'They know safest routes and seasonal trail conditions',
            'They interpret animal behaviour and position groups at safe viewing distances',
            'They connect you to local conservation and community stories',
            'They are trained in first aid, wildlife management, and evacuation coordination'
        ]
    },
    {
        id: 'kampala',
        title: 'While in Kampala',
        icon: 'info',
        summary: 'Cities carry higher petty-theft risk than rural park gateways.',
        bullets: [
            'Avoid walking alone after dark outside well-known tourist areas',
            'Use a concealed money belt — keep only small cash in pockets',
            'Violent crime against tourists is rare but stay aware in crowds'
        ]
    },
    {
        id: 'transport_risk',
        title: 'Advice for self-guided road travel',
        icon: 'map',
        summary: 'Vehicle travel is often the highest practical risk visitors face in Uganda.',
        bullets: [
            'Many roads are potholed — speak calmly if uncomfortable with driving',
            'Avoid night travel — risks increase substantially after dark',
            'Self-driving often costs more — booking a vehicle with driver is the norm'
        ]
    },
    {
        id: 'transport_guided',
        title: 'Guided tours and local transport',
        icon: 'info',
        summary: 'Reputable safari operators prioritise vehicle safety over informal options.',
        bullets: [
            'Report safety concerns to your tour company — they want feedback',
            'Boda-boda motorcycles: helmets are rare — not recommended for visitors',
            'Matatu minibuses: variable standards — prefer arranged tourist transfers',
            'Use lodges or tour companies to book airport transfers when possible'
        ]
    }
];

module.exports = {
    SOURCE_URL,
    TITLE: 'Staying safe in Bwindi',
    INTRO:
        'Complete health, trekking, packing, wildlife, and travel guidance for Bwindi Impenetrable National Park, adapted from the official Bwindi travel guide. Use this with your UWA ranger briefing and permit conditions.',
    RECAP_ITEMS,
    PACKING,
    SECTIONS
};
