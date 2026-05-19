/**
 * Curated tourist wildlife checklist aligned with the Bwindi "Staying Safe" travel guide.
 * @see https://www.bwindiimpenetrablenationalpark.com/travel-guide/staying-safe/
 */

const SOURCE_URL = 'https://www.bwindiimpenetrablenationalpark.com/travel-guide/staying-safe/';

const GORILLA_GOLDEN_RULES = [
    {
        title: 'Keep a safe distance',
        detail: 'Stay at least 7 m (about 23 ft) from gorillas to limit disease transmission and stress.'
    },
    {
        title: 'Follow your guide',
        detail: 'Rangers interpret behaviour—never approach gorillas without their direction.'
    },
    {
        title: 'Stay calm and quiet',
        detail: 'Avoid sudden movements and loud noises that can startle habituated groups.'
    },
    {
        title: 'Avoid direct eye contact',
        detail: 'Prolonged staring can be read as a challenge; observe from the side when possible.'
    },
    {
        title: 'No food or drink near gorillas',
        detail: 'Prevents contamination and stops gorillas associating people with meals.'
    },
    {
        title: 'Report illness before trekking',
        detail: 'Human colds and flu can harm gorillas—postpone the trek if you feel unwell.'
    }
];

/**
 * Species explicitly called out on the Staying Safe guide (gorillas, elephants,
 * monkeys/primates, antelope). Birding is covered under packing (binoculars) — see Info guide.
 */
const TOURIST_SPECIES = [
    {
        name: 'Mountain Gorilla',
        group: 'great_apes',
        group_label: 'Great apes',
        safety_tip:
            'Maintain at least 7 m (about 23 ft). Move slowly, avoid loud noises and prolonged eye contact. If a gorilla approaches, crouch and stay calm.'
    },
    {
        name: 'African Forest Elephant',
        group: 'megafauna',
        group_label: 'Forest megafauna',
        safety_tip:
            'Can be unpredictable. Stay calm, keep a safe distance, and retreat slowly without turning your back.'
    },
    {
        name: 'Black-and-white Colobus',
        group: 'primates',
        group_label: 'Primates',
        safety_tip:
            'Colobus monkeys are usually harmless but can become aggressive if threatened. Do not feed or attempt to touch them.'
    },
    {
        name: "L'Hoest's Monkey",
        group: 'primates',
        group_label: 'Primates',
        safety_tip:
            'Smaller primates may cross trails — never feed or harass troops. Keep food packed away on forest walks.'
    },
    {
        name: 'Blue Monkey',
        group: 'primates',
        group_label: 'Primates',
        safety_tip:
            'Stay with your guide when monkeys alarm-call. Avoid cornering animals on narrow paths.'
    },
    {
        name: 'Olive Baboon',
        group: 'primates',
        group_label: 'Primates',
        safety_tip:
            'Do not feed baboons or leave food unattended. Sudden approaches can provoke aggressive displays.'
    },
    {
        name: 'Bushbuck',
        group: 'antelope',
        group_label: 'Antelope',
        safety_tip:
            'Shy antelope may freeze on trails — give space and let your guide lead past before you step forward.'
    },
    {
        name: 'Yellow-backed Duiker',
        group: 'antelope',
        group_label: 'Antelope',
        safety_tip:
            'Duikers bolt through dense undergrowth — stay on marked paths and announce your presence on blind corners.'
    }
];

/** Non-catalogue reminders from the same guide page. */
const TRAIL_REMINDERS = [
    {
        title: 'Snakes and insects',
        detail:
            'Bwindi’s dense forest hosts various snake species. Wear protective boots, stay on designated trails, and avoid reaching into vegetation.'
    },
    {
        title: 'Birdwatching',
        detail:
            'Bring binoculars for distant wildlife. The official guide recommends them for birding — use optics rather than playback near nests.'
    }
];

module.exports = {
    SOURCE_URL,
    GORILLA_GOLDEN_RULES,
    TOURIST_SPECIES,
    TRAIL_REMINDERS
};
