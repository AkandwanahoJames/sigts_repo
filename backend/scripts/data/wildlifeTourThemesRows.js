/** Seed rows for Animals-tab UNESCO wildlife tour theme briefing modals (`wildlife_tour_themes` table). */
module.exports = [
    {
        slug: 'all',
        session_title: 'Full trail biodiversity block',
        subtitle: 'Panorama session when the group wants the whole Bwindi story',
        tourist_summary_en: 'This block keeps every taxonomic chapter in play: great apes anchor attention, but birds, butterflies, trees, and small mammals complete why Bwindi is a global conservation priority. Use it when you have time on the trail between focal sightings.',
        guide_script_en: 'Frame the walk as chapters: primates first for emotional hook, then birds or plants by ear and light, then large mammals as bonus scenes. Remind guests silence is a tool; sound reveals what eyes miss. Close by linking their permit fees to monitoring, community revenue, and law enforcement that keep this forest intact.',
        talking_points: [
            'Bwindi blends Albertine Rift endemics with Congo-basin and eastern African influences because of its position on the rift shoulder.',
            'Half the story is vertical: understory duikers, mid-storey fruiting trees, canopy primates and raptors.',
            'If energy drops, micro-stories (ferns, ants, fungi) keep momentum without inventing sightings.'
        ],
        safety_notes: 'General rule: stay behind the lead ranger, do not leave the line, and announce stumbles loudly enough that the rear guard hears.',
        etiquette_notes: 'One voice speaks at a time. Phones on silent unless agreed for quick photos under ranger rules. Packs tight so passing groups can stagger safely.',
        suggested_duration_minutes: 35,
        unesco_note: 'UNESCO World Heritage property 682 recognizes exceptional terrestrial biodiversity (scenic natural values and threatened species assemblies) in this montane rainforest complex.',
        image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Bwindi_National_Park.jpg/960px-Bwindi_National_Park.jpg',
        sort_order: 10
    },
    {
        slug: 'unesco_primates',
        session_title: 'Great apes & forest primates slot',
        subtitle: 'Gorilla permit treks plus monkey-focused listening stretches',
        tourist_summary_en: "Mountain gorillas are the headline species, yet l'Hoest's monkeys, other cercopithecids, and occasionally chimpanzees appear in vignettes depending on sector and habituation. Guests learn why primate-centered tourism finances protection but also concentrates human pressure.",
        guide_script_en: 'Open by naming the trekking rules already in briefing: masks when required, distance, coughing protocol, no feeding. Pivot to monkeys: fast, perpendicular sight lines, listen for cascading alarm calls rippling uphill. Mention researchers track health bridges between villagers and gorillas; your hygiene matters.',
        talking_points: [
            'Gorillas: one hour viewing cap (unless special research). Queue breathing and camera discipline before arrival so guests stay calm.',
            'Monkeys: contrast leaf-chomping versus fruit-chasing crews; binoculars beat rushing forward.',
            'If chimps rumored nearby, emphasize different flight distance and quieter approach. Defer to trackers.'
        ],
        safety_notes: 'Keep Uganda Wildlife Authority separation. Never touch primates; disease moves both ways. If animals close in, follow the lead ranger’s slow step back drill.',
        etiquette_notes: 'No flash photography; avoid pointing directly at faces; backpacks off only when ranger signals a safe standstill.',
        suggested_duration_minutes: 40,
        unesco_note: 'World Heritage dossier narratives highlight charismatic primates (mountain gorillas and diverse forest monkeys) as frontline conservation species reliant on anti-poaching and health monitoring.',
        image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Mountain_gorilla_silverback_JJ.jpg/640px-Mountain_gorilla_silverback_JJ.jpg',
        sort_order: 20
    },
    {
        slug: 'unesco_large_mammals',
        session_title: 'Forest elephants & large mammal beat',
        subtitle: 'Wide-ranging mammals that need distance and acoustic patience',
        tourist_summary_en: 'Forest elephants carve trails, mineral seeps cue drama, buffalo or duiker sightings punctuate quieter hiking. Probability varies. Position this module as stewardship listening, not a zoo guarantee.',
        guide_script_en: 'Describe toe-print versus round hoof, dung crumble for browsing versus fibrous grazing, snapped saplings waist-high versus shoulder-high. Invite guests to imitate tracker cadence: pause every 80 to 100 metres to scan acoustically.',
        talking_points: [
            'Elephants funnel along ridge saddles late afternoon; midday heat often lowers encounter rates.',
            'Buffalo herds demand wider arcs. Stay downwind mentally even if topography hides you.',
            'Duikers illustrate seed dispersal; link shotgun ecology to ranger snare sweeps.'
        ],
        safety_notes: 'Never wedge between calves and adults; lateral retreat upslope beats running downhill where footing fails.',
        etiquette_notes: 'Whisper drills. Trekking poles tapped lightly, not hammered, so wildlife hears human rhythm predictably.',
        suggested_duration_minutes: 25,
        unesco_note: 'Large-bodied mammals (including iconic megaherbivores noted in dossier summaries) underscore ecosystem roles shaping forest structure beside dense settlements.',
        image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/African_forest_elephant_exported_%28square%29.jpg/640px-African_forest_elephant_exported_%28square%29.jpg',
        sort_order: 30
    },
    {
        slug: 'unesco_albertine_birds',
        session_title: 'Albertine endemic & montane birds module',
        subtitle: 'Specialty passerines from dossier summaries: listening first, glimpses second',
        tourist_summary_en: 'This session trains ears: green broadbill hoots, warbler chatter in swamp tangles, flycatchers sallying shaded gaps. Albertine Rift speciality is why many guests pack serious optics. Even short canopy vistas reward patience.',
        guide_script_en: 'Chunk time: twelve minutes stationary listening, eight minutes creeping to the next acoustic window. Rotate narration so photographers get windows without chatter overlap. Mention altitudinal layering: some species cling to moss belts others avoid.',
        talking_points: [
            'Playback phone apps follow UWA and lead-guide policy exactly. Never improvise playback alone.',
            'Mixed flocks can hold residents plus wanderers. Log bill colour and tail length quietly.',
            'Rain capes rustle loudly. Budget pauses right after gearing up.'
        ],
        safety_notes: 'Watch footing on wet logs while staring up. Use a buddy shoulder tap before someone steps backward blind.',
        etiquette_notes: 'Caps brims tipped up with slow pivots. Point using whole-hand arcs rather than shouted compass slang.',
        suggested_duration_minutes: 30,
        unesco_note: 'Outstanding universal value summaries stress exceptional richness of forest-dependent birds (Albertine Rift constituents) for ecological importance at this property.',
        image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/African_Green_Broadbill.jpg/640px-African_Green_Broadbill.jpg',
        sort_order: 40
    },
    {
        slug: 'unesco_swallowtails',
        session_title: 'Butterfly & light-gap choreography',
        subtitle: 'Showy Lepidoptera, including swallowtails called out beside broader butterfly richness',
        tourist_summary_en: 'Butterflies map microclimate: muddy seeps after rain, sunflecks on landslide scars, ridges that vent warm moist air midday. Tie human behaviour (where we stand shading puddles) to ethical viewing.',
        guide_script_en: 'Invite guests to note flight height: swallowtails often beat higher than blues or skippers. Mention hilltopping sparingly; it excites naturalists without overpromising. Connect larvae hosts with trail side vines rangers survey.',
        talking_points: [
            'Early wet-season emergence spikes but also slick rocks. Soles before chase shots.',
            'Polarised lenses help framing but dull some iridescence. Tell guests when to slip them off.',
            'Minimise flash and sudden arms. Thermalling insects bank predictably along lit corridors.'
        ],
        safety_notes: 'Ledges near sun gaps are slick. Plant poles before lunging toward frame-filling snaps.',
        etiquette_notes: 'Step off tread only when the flank guide clears space. Ants adore the same sunny edges.',
        suggested_duration_minutes: 20,
        unesco_note: 'Interpretive dossiers reference outstanding lepidopteran richness, with swallowtails as approachable flagship cues when guests need visible motion.',
        image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Papilio_antimachus.jpg/640px-Papilio_antimachus.jpg',
        sort_order: 50
    },
    {
        slug: 'globally_threatened',
        session_title: 'Red List frontline stewardship talk',
        subtitle: 'When sightings are thin, credit patrols and habitat work instead of filling silence with guesses',
        tourist_summary_en: 'Many marquee species carry IUCN Red List statuses; this session reframes success as evidence of protection (silent forest can mean avoidance, not emptiness). Connect tourism to ranger patrol arcs, canine units, and corridor diplomacy.',
        guide_script_en: 'Script honesty: sightings are stochastic. Celebrate wins guests funded: sanctioned clinics, classrooms, roadside snare removal totals from UWA or community cooperatives when numbers are verified.',
        talking_points: [
            'Separate endangered versus vulnerable cleanly. Tourist audiences ask for clarity.',
            'Tie visitation hygiene to cross-species disease risk without needless fear.',
            'If ivory or pangolin rumours surface, stay with verified facts.'
        ],
        safety_notes: 'Do not scramble downslope chasing silhouettes beyond posted limits. Vertical rescue beats ego.',
        etiquette_notes: 'Steer souvenir conversations away from dubious wildlife artefacts. Mention legal artisan cooperatives.',
        suggested_duration_minutes: 25,
        unesco_note: 'Heritage rationales coupling superlative forests with assemblies of threatened taxa depend on monitoring, law reinforcement, and long political support.',
        image_url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/A_group_of_imp_chimps.jpg/640px-A_group_of_imp_chimps.jpg',
        sort_order: 60
    }
];
