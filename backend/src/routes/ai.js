const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateJWT } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { retrieveSigtsKnowledge, formatClientCatalogueSnapshot } = require('../services/chatGrounding');
const { completeChat, isLLMConfigured, readChatEnv } = require('../services/llmChat');

router.use(authenticateJWT);

function clampStr(value, max) {
    if (value == null) return '';
    const t = String(value).replace(/\s+/g, ' ').trim();
    if (!t) return '';
    return t.length <= max ? t : `${t.slice(0, Math.max(0, max - 1))}…`;
}

function normalizeTourHelpQuestion(question) {
    return String(question || '')
        .normalize('NFKC')
        .replace(/[\u200b-\u200d\ufeff]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/** Client-supplied SIGTS catalogue snapshot (themes, animals, map, culture, FAQs, safety). */
function sanitizeAppContext(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return null;
    }
    const out = {
        themes: [],
        animals: [],
        locations: [],
        stories: [],
        faqs: [],
        safety_species: [],
        weather: null,
        catalog_meta: null,
    };

    if (Array.isArray(raw.themes)) {
        for (const t of raw.themes.slice(0, 24)) {
            if (!t || typeof t !== 'object') continue;
            const session_title = clampStr(t.session_title || t.title, 200);
            const slug = clampStr(t.slug, 80);
            if (!session_title && !slug) continue;
            out.themes.push({
                slug,
                session_title,
                subtitle: clampStr(t.subtitle, 240),
                tourist_summary_en: clampStr(t.tourist_summary_en, 720),
            });
        }
    }

    if (Array.isArray(raw.animals)) {
        for (const a of raw.animals.slice(0, 320)) {
            if (!a || typeof a !== 'object') continue;
            const name = clampStr(a.name, 160);
            if (!name) continue;
            out.animals.push({
                name,
                scientific_name: clampStr(a.scientific_name || a.scientific, 200),
            });
        }
    }

    if (Array.isArray(raw.locations)) {
        for (const l of raw.locations.slice(0, 48)) {
            if (!l || typeof l !== 'object') continue;
            const name = clampStr(l.name, 160);
            if (!name) continue;
            out.locations.push({
                name,
                location_type: clampStr(l.location_type || l.type, 48),
                description: clampStr(l.description, 280),
            });
        }
    }

    if (Array.isArray(raw.stories)) {
        for (const s of raw.stories.slice(0, 24)) {
            if (!s || typeof s !== 'object') continue;
            const title = clampStr(s.title || s.title_en, 200);
            if (!title) continue;
            out.stories.push({
                title,
                community: clampStr(s.community, 40),
                summary: clampStr(s.summary || s.narrative_en, 400),
            });
        }
    }

    if (Array.isArray(raw.faqs)) {
        for (const f of raw.faqs.slice(0, 32)) {
            if (!f || typeof f !== 'object') continue;
            const question = clampStr(f.question || f.question_en, 240);
            const answer = clampStr(f.answer || f.answer_en, 400);
            if (!question) continue;
            out.faqs.push({ question, answer, category: clampStr(f.category, 48) });
        }
    }

    if (Array.isArray(raw.safety_species)) {
        for (const s of raw.safety_species.slice(0, 16)) {
            if (!s || typeof s !== 'object') continue;
            const name = clampStr(s.name, 120);
            if (!name) continue;
            out.safety_species.push({
                name,
                safety_tip: clampStr(s.safety_tip, 320),
            });
        }
    }

    if (raw.weather && typeof raw.weather === 'object') {
        out.weather = {
            condition: clampStr(raw.weather.condition, 80),
            temperatureC: raw.weather.temperatureC,
            rainProbabilityPct: raw.weather.rainProbabilityPct,
        };
    }

    if (raw.catalog_meta && typeof raw.catalog_meta === 'object') {
        out.catalog_meta = {
            animals: Number(raw.catalog_meta.animals) || 0,
            locations: Number(raw.catalog_meta.locations) || 0,
        };
    }

    const hasData =
        out.themes.length ||
        out.animals.length ||
        out.locations.length ||
        out.stories.length ||
        out.faqs.length ||
        out.safety_species.length ||
        out.weather ||
        out.catalog_meta;

    if (!hasData) return null;
    return out;
}

function wantsAnimalCatalogContext(q) {
    return (
        /\b(animals?|species|biodiversity|catalogues?|catalogs?|catalogue|catalog|present|listed|grid|field brief|which|how many)\b/.test(q) ||
        q.includes('species to')
    );
}

function wantsTourThemeContext(q) {
    return /\b(tours?|activities?|activity|theme|themes|briefing|session|guided|unesco|tile|tiles)\b/.test(q);
}

function findMentionedAnimal(qLower, animals) {
    if (!Array.isArray(animals) || !animals.length) return null;
    const sorted = [...animals].sort((a, b) => (b.name || '').length - (a.name || '').length);
    for (const a of sorted) {
        const n = String(a.name || '').toLowerCase().trim();
        if (n.length >= 3 && qLower.includes(n)) {
            return a;
        }
    }
    return null;
}

/** True when the question is plausibly about Bwindi Impenetrable NP / its setting (not strict proof). */
function isBwindiParkContextQuery(q) {
    if (q.includes('bwindi')) return true;
    if (/\b(buhoma|ruhija|rushaga|nkuringo)\b/i.test(q)) return true;
    if (/\bbwindi[-\s]?impenetrable\b/i.test(q)) return true;
    if (/\bimpenetrable\s+national\s+park\b/i.test(q)) return true;
    if (/\b(binp|bwindi\s+imp\.?\s*n\.?p\.?|bwindi\s+np)\b/i.test(q)) return true;
    if (/\buganda\s+wildlife\b/i.test(q) || /\buwa\b/i.test(q)) return true;
    if (/\b(kanungu|kisoro|kabale)\b/i.test(q)) return true;
    if (/\b(south-?western|southwestern)\s+uganda\b/i.test(q)) return true;
    if (/\bworld\s+heritage\b/i.test(q) && (/\b682\b/.test(q) || /\bbwindi\b/i.test(q))) return true;
    if (/\balbertine\b/i.test(q) && /\b(forest|rift|gorilla|endemic)\b/i.test(q)) return true;
    if (/\b(gorilla\s+trek|gorilla\s+tracking|habituation\s+trek|gorilla\s+habituation)\b/i.test(q)) return true;
    if (/\b(primate\s+trek|forest\s+habituation|nature\s+walk)\b/i.test(q) && /\b(uganda|bwindi|forest)\b/i.test(q)) {
        return true;
    }
    if (/\b(national\s+park)\b/i.test(q) && /\b(uganda|western|montane|rainforest)\b/i.test(q)) return true;
    if (/\b(this\s+park|the\s+park)\b/i.test(q) && /\b(visit|trek|size|rules|animals|here|sigts)\b/i.test(q)) return true;
    if (/\bimpenetrable\s+forest\b/i.test(q)) return true;
    if (/\bwestern\s+uganda\b/i.test(q)) return true;
    if (/\buganda\b/i.test(q) && /\b(forest|gorilla|trek|rainforest|primate|montane)\b/i.test(q)) return true;
    if (/\bsigts\b/i.test(q)) return true;
    return false;
}

function looksClearlyOffTopic(q) {
    return /\b(python|javascript|typescript|sql\s+query|react\.?js|node\.?js|excel\s+formula|homework\s+problem|nba\s+score|stock\s+price|netflix|movie\s+times|recipe|pizza\s+dough|tax\s+return\s+software)\b/i.test(
        q
    );
}

/** Latest user utterance only (normalised lower-case). Threads used to concatenate assistant replies could otherwise re-trigger gorilla/permit shortcuts. */
function isBareSocialUtterance(qlLatest) {
    const inner = String(qlLatest || '')
        .trim()
        .replace(/^[\u00a1\u00bf]+\s*/i, '')
        .replace(/^[!….,\-–—:;'`"]+/, '')
        .replace(/[!….,\-–—:;'`"]+$/, '')
        .trim();
    if (!inner || inner.length > 112) return false;
    if (looksClearlyOffTopic(inner)) return false;

    return (
        /^(hi|hello|hey|yo|sup|howdy|greetings)(\s+(there|everyone|everybody|team|buddy|friend|sir|madam|folks|again))?$/i.test(
            inner
        ) ||
        /^good\s+(morning|afternoon|evening)(\s+(there|everyone|everybody|all))?$/i.test(inner) ||
        /^thank\s+you(\s+(so\s+much|very\s+much|again))?$/i.test(inner) ||
        /^thanks(\s+(so\s+much|a\s+lot|again))?$/i.test(inner) ||
        /^ty$/i.test(inner) ||
        /^(ok+|okay+)(\s+(thanks|thank\s+you))?$/i.test(inner) ||
        /^(morning|afternoon)$/i.test(inner) ||
        /^what'?s\s+up(\s+(buddy|friend|there))?$/i.test(inner)
    );
}

function buildSocialGreetingReply(locationName) {
    const geo = locationName
        ? ` If the map thumbnail is open, SIGTS loosely pins you near “${locationName}”—still verify on paper maps and ranger briefings.`
        : '';
    return `Hi there—glad you’re here. I’m the in-app Bwindi guide: think of me as a calm voice before you meet your ranger team.${geo} Are you tilting toward gorilla-day logistics, forest walking & bird snippets, Culture stories here in SIGTS, or something else entirely?`;
}

/** Forest / trek / wildlife wording without naming Bwindi (still in scope for this app). */
function isNatureTourismTopic(q) {
    return /\b(wildlife|trek|trekking|trail|hike|hiking|forest|jungle|rainforest|safari|monkey|ape|birding|bird\s|primates?|ranger|guide\s|permit|sightings?|ecology|conservation|national\s+park|buffer\s*zone|fauna|flora|endemic|montane|elevat|tracking)\b/i.test(
        q
    );
}

function buildBwindiScopedAnswer(question, locationName, appContext) {
    const q = normalizeTourHelpQuestion(question);
    if (/\bwhat\s+(is|are)\s+bwindi\b/.test(q) || (/\bwhat\s+is\b/.test(q) && q.includes('bwindi'))) {
        return 'Bwindi Impenetrable National Park is a protected montane rainforest in southwestern Uganda, globally known for mountain gorillas and Albertine Rift biodiversity.';
    }
    if (/\b(permit|fee|cost|price|ticket)\b/.test(q)) {
        return 'Permit and fee values change by policy and season. Use current UWA tariff information and your issued permit details for exact pricing.';
    }
    if (/\b(bird|birding|ornith)\b/.test(q)) {
        return 'Bwindi is a major Albertine Rift birding site with many regional endemics. For practical spotting guidance, use quiet movement and follow guide/ranger instructions.';
    }
    if (/\b(season|dry|wet|when\s+to\s+visit|best\s+time)\b/.test(q)) {
        return 'Drier periods are often preferred for easier trail conditions, but rain can occur year-round in Bwindi. Plan waterproof layers and good-traction footwear in any season.';
    }
    if (/\b(size|area|km2|km²|hectare|acre|how\s+big)\b/.test(q)) {
        return 'Bwindi is commonly cited at about 331 km² of montane rainforest.';
    }
    if (/\b(elevation|altitude|steep|terrain|hiking\s+hard)\b/.test(q)) {
        return 'Bwindi terrain is steep and often muddy, with montane elevation changes. Expect physically demanding hikes and pace accordingly.';
    }
    if (/\b(chimp|elephant|buffalo|leopard)\b/.test(q)) {
        return 'These species occur in wider Ugandan ecosystems, but sightings in Bwindi vary by sector and conditions. Follow ranger guidance for current wildlife movement.';
    }

    const base = 'Bwindi is a protected Ugandan montane rainforest best known for gorilla trekking and high biodiversity.';
    const nearby = locationName ? ` Nearby mapped label: ${locationName}.` : '';
    const contextHint = appContext?.animals?.length
        ? ` SIGTS currently has ${appContext.animals.length} animal records if you want species-specific detail.`
        : '';
    return clampStr(`${base}${nearby}${contextHint}`, 700);
}

/**
 * Theme / catalogue heuristics must use **only the visitor’s latest message**.
 * Older assistant turns often repeat species names (e.g. “gorillas…”) which would falsely mark a follow‑up “hello”.
 */
function buildAnswerFromAppContext(latestUserPlain, mergedThreadPlain, appContext, locationName) {
    if (!appContext) return null;
    const qLatest = normalizeTourHelpQuestion(latestUserPlain);
    if (!qLatest.length || isBareSocialUtterance(qLatest)) return null;

    const mentioned = findMentionedAnimal(qLatest, appContext.animals);
    const wantAnimals = Boolean(appContext.animals?.length && (wantsAnimalCatalogContext(qLatest) || mentioned));
    const wantThemes = Boolean(appContext.themes?.length && wantsTourThemeContext(qLatest));

    if (!wantAnimals && !wantThemes) {
        return null;
    }

    const parts = [];

    if (wantThemes && appContext.themes.length) {
        const listed = appContext.themes
            .slice(0, 3)
            .map((t) => t.session_title || t.slug || 'Tour session')
            .filter(Boolean);
        parts.push(
            `Available tour themes: ${listed.join(', ')}${appContext.themes.length > 3 ? ` (+${appContext.themes.length - 3} more)` : ''}.`
        );
    }

    if (wantAnimals && appContext.animals.length) {
        const n = appContext.animals.length;
        parts.push(`Animals catalogue for Bwindi currently lists ${n} species.`);
        if (mentioned) {
            const sci = mentioned.scientific_name ? ` (${mentioned.scientific_name})` : '';
            parts.push(`You asked about ${mentioned.name}${sci}; open that species card for details in this SIGTS build.`);
        }
    }

    let text = parts.join('\n\n');
    text = clampStr(text, 700);
    if (locationName) {
        text += ` Nearby map label in data: ${locationName} (confirm on the ground).`;
    }
    return text;
}

/** Client prior turns { role, text }[] — merged into one rules pass for short follow-ups (e.g. “what about permits?”). */
function sanitizeChatHistory(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const row of raw.slice(-20)) {
        if (!row || typeof row !== 'object') continue;
        const role = row.role === 'assistant' ? 'assistant' : row.role === 'user' ? 'user' : null;
        if (!role) continue;
        const text = clampStr(row.text, 1800);
        if (text.length < 1) continue;
        out.push({ role, text });
    }
    return out;
}

function composeThreadForRules(question, history) {
    const q = String(question || '').trim();
    if (!history.length) return q;
    const chunks = [];
    for (const h of history) {
        const label = h.role === 'user' ? 'Visitor' : 'Assistant';
        chunks.push(`${label}: ${h.text}`);
    }
    chunks.push(`Follow-up: ${q}`);
    return clampStr(chunks.join('\n\n'), 8000);
}

/**
 * @param {string} latestUserOnly - Raw current visitor message only (intent keywords evaluated here).
 * @param {string|null|undefined} mergedThread - Visitor + Assistant transcript + Follow-up (catalogue/threaded context only).
 */
function buildRuleBasedAnswer(latestUserOnly, mergedThread, context = {}) {
    const ql = normalizeTourHelpQuestion(latestUserOnly);
    const qThreadRaw = mergedThread != null && String(mergedThread).trim() !== '' ? String(mergedThread) : latestUserOnly;
    const qt = normalizeTourHelpQuestion(qThreadRaw);

    const { locationName, appContext } = context;

    if (isBareSocialUtterance(ql)) {
        return buildSocialGreetingReply(locationName);
    }

    if (/\bgorilla\b/.test(ql)) {
        return `Totally fair—gorillas are why most of us memorize “Bwindi” in the first place. Stay calm, whisper when guides whisper, skip flash forever, keep that ~7 m bubble, and let rangers reposition you if branches narrow the sightline.${locationName ? ` Looks like SIGTS loosely tags you near “${locationName}”—verify with your group’s ranger map.` : ''} Want etiquette for mud & gloves next, or how Culture stories sit alongside trekking briefings?`;
    }
    if (/\bsafety\b/.test(ql) || /\bsafe\b/.test(ql)) {
        return `Safety first—it’s steep forest, slippery roots, and occasional wildlife corridors. Stick to ranger lines, shout if you tumble (so the sweep hears you), hydrate before you slam elevation, and never split the formation for a selfie.${locationName ? ` SIGTS pings you loosely around “${locationName}”; never treat that dot as evacuation intel.` : ''} Need health/packing angles or large-mammal etiquette?`;
    }
    if (/\b(weather|rain|rainy)\b/.test(ql)) {
        return `Cloud forest mood: mist can flirt with sunshine on the same ascent. Toss a breathable rain shell plus quick-drying layers in your sack even if sunrise looks tame—trail shoes with real bite trump fashion trainers every time.\n\nIf you’d rather talk dry-season pacing vs rainforest drizzle psychology, poke me either way.`;
    }
    if (/\b(culture|cultural|batwa|bakiga)\b/.test(ql)) {
        return `Culture here isn’t garnish—it’s intertwined with stewardship of the ridges. Dive into SIGTS Culture cards for narrator-approved Batwa/Bakiga stories, then treat community visits like listening sessions: ask before recording, honor taboos spelled out inside each card, and defer to interpreters on compensation norms.\n\nCurious where cultural walks meet gorilla-sector logistics? Say the word.`;
    }
    if (/\b(route|routes|map|direction)\b/.test(ql)) {
        return `Map tab is your campfire GPS inside SIGTS: gate labels, lodges, viewpoints, and ranger POIs—but paper park maps still win offline surprises.${locationName ? ` Rough pin: “${locationName}”; please double-check onsite.` : ''} Want sector-by-sector moods (Buhoma vs Rushaga energy) instead?`;
    }

    const fromCatalogue = buildAnswerFromAppContext(latestUserOnly, qThreadRaw, appContext, locationName);
    if (fromCatalogue) {
        return fromCatalogue;
    }

    if (!looksClearlyOffTopic(qt) && (isBwindiParkContextQuery(qt) || isNatureTourismTopic(qt))) {
        return buildBwindiScopedAnswer(qThreadRaw, locationName, appContext);
    }

    const tip = locationName ? ` Loose map breadcrumb—"${locationName}"—confirm with your ranger sheet though.` : '';
    return `Hmm—I’m happiest when we’re unpacking Bwindi together: trekking headspace, mammal & bird breadcrumbs in the Animals catalogue, Culture narrators stored here, FAQs, soggy-boot logistics, permits at a conceptual level (UWA tariffs change), or sector vibes across Buhoma, Ruhija, Rushaga, Nkuringo.\n\nI’ll gently bounce truly off-grid topics.${tip}\n\nPick one itch—mud dread, binocular ethics, Batwa storyline timing, whichever—and we’ll riff from the same playbook your offline SIGTS build uses when the cliff drops signal.`;
}

function buildServerTimeContextNote() {
    const h = new Date().getUTCHours();
    if (h < 6) return 'UTC night window: confirm local briefing times with your lodge and UWA schedule.';
    if (h < 12) return 'UTC morning: early gates and mist layers are common—sync boots and rain shells before leaving.';
    if (h < 17) return 'UTC midday: pace hydration on climbs; canopy shade vs ridge sun can differ sharply.';
    return 'UTC evening: plan margin for slower exits on muddy descents.';
}

function deriveAnswerSources(question, answer, appContext, locationName, groundingMeta = null, nlpMode = 'rule_kb_v1') {
    const sources =
        nlpMode === 'llm_grounded_v1'
            ? ['SIGTS LLM (OpenAI-compatible) grounded on Postgres + catalogue snapshot']
            : nlpMode === 'rule_kb_v1_fallback'
              ? ['SIGTS interpreter — rules fallback (LLM unavailable or failed)']
              : ['SIGTS curated Bwindi interpreter (rule + knowledge paths)'];
    if (locationName) {
        sources.push(`Locations dataset — nearest mapped label: ${locationName}`);
    }
    if (groundingMeta?.faqHits) {
        sources.push(`FAQs (${groundingMeta.faqHits} lexical matches)`);
    }
    if (groundingMeta?.safetyHits) {
        sources.push(`Safety tips (${groundingMeta.safetyHits} matches)`);
    }
    if (groundingMeta?.destHits) {
        sources.push(`Park guide snippets (${groundingMeta.destHits} matches)`);
    }
    if (groundingMeta?.animalHits) {
        sources.push(`Animals (${groundingMeta.animalHits} species rows)`);
    }
    if (groundingMeta?.themeHits) {
        sources.push(`Wildlife tour themes (${groundingMeta.themeHits} matches)`);
    }
    if (groundingMeta?.cultureHits) {
        sources.push(`Cultural narratives (${groundingMeta.cultureHits} matches)`);
    }
    if (groundingMeta?.locationHits) {
        sources.push(`Map locations (${groundingMeta.locationHits} matches)`);
    }
    if (groundingMeta?.tourContentHits) {
        sources.push(`Tour content (${groundingMeta.tourContentHits} matches)`);
    }
    if (groundingMeta?.routeHits) {
        sources.push(`Trek routes (${groundingMeta.routeHits} in knowledge pack)`);
    }
    if (groundingMeta?.sightingHits) {
        sources.push(`Recent sightings (${groundingMeta.sightingHits} anecdotal rows)`);
    }
    if (groundingMeta?.coreBriefing) {
        sources.push('SIGTS core park briefing (always-on context)');
    }
    if (appContext?.animals?.length) {
        sources.push(`Client Animals catalogue snapshot (${appContext.animals.length} species)`);
    }
    if (appContext?.themes?.length) {
        sources.push(`Client wildlife tour theme briefings (${appContext.themes.length} sessions)`);
    }
    if (appContext?.locations?.length) {
        sources.push(`Client map POIs (${appContext.locations.length})`);
    }
    if (appContext?.stories?.length) {
        sources.push(`Client cultural stories (${appContext.stories.length})`);
    }
    if (appContext?.faqs?.length) {
        sources.push(`Client cached FAQs (${appContext.faqs.length})`);
    }
    if (appContext?.safety_species?.length) {
        sources.push(`Client staying-safe species (${appContext.safety_species.length})`);
    }
    if (appContext?.weather) {
        sources.push('Client weather capsule');
    }
    const a = String(answer || '').toLowerCase();
    if (a.includes('unesco') || a.includes('heritage')) sources.push('UNESCO list 682 framing (public summary)');
    if (a.includes('uwa') || a.includes('permit')) sources.push('Uganda Wildlife Authority visitor conduct norms (general)');
    if (a.includes('catalogue') || a.includes('species')) sources.push('On-device biodiversity catalogue');
    return [...new Set(sources)];
}

/** When an LLM API key is configured, route in-app visitor questions through it (rules remain offline fallback). */
function shouldUseLlmForQuestion(question, mergedThread) {
    const ql = normalizeTourHelpQuestion(question);
    if (!ql.length) return false;
    if (looksClearlyOffTopic(ql)) return false;

    const qt = normalizeTourHelpQuestion(mergedThread || question);
    if (looksClearlyOffTopic(qt) && !isBwindiParkContextQuery(ql) && !isNatureTourismTopic(ql)) {
        return false;
    }

    return true;
}

function buildRetrievalQuery(question, history) {
    const parts = [String(question || '').trim()];
    if (Array.isArray(history)) {
        history
            .filter((h) => h && h.role === 'user')
            .slice(-3)
            .forEach((h) => {
                const t = String(h.text || '').trim();
                if (t.length >= 2) parts.push(t);
            });
    }
    return clampStr(parts.join('\n'), 4000);
}

function buildLlmSystemPrompt({ language, locationName, knowledgePack, serverTimeISO, utcNote }) {
    const locale = clampStr(language || 'en', 8);
    const locHint = locationName ? `Nearby mapped POI label (approximate): ${locationName}` : 'No coarse location match in SIGTS.';
    return [
        `You are the in-app conversational guide “SIGTS Tour Help” for visitors planning or enjoying **Bwindi Impenetrable National Park**, Uganda.`,
        `Write naturally in "${locale}" unless the visitor clearly switched language mid-thread.`,
        'Tone: warm, succinct field-guide energy—friendly human ranger briefing, never corporate boilerplate.',
        'Carry conversation: briefly acknowledge what they asked or how they sounded (worried, excited, confused—only if evident). Prefer one or two short paragraphs; use bullets only when the visitor asked for steps, packing lists, or “give me bullets”.',
        'When it fits, end with **one** light follow-up invitation (single sentence), e.g. “Want muddy-boot tips or permits-in-general wording?” Avoid stacking multiple rhetorical questions.',
        'GROUNDING: The KNOWLEDGE BASE is retrieved live from SIGTS Postgres (FAQs, safety tips, park guide, animals, cultural narratives, locations, tour themes, routes, sightings) plus any device snapshot. Prefer facts found there; paraphrase naturally.',
        'If KNOWLEDGE BASE lacks the answer (exact permit price, quotas, closures, medical advice), say so plainly and steer them to **Uganda Wildlife Authority**, lodge staff, or on-site rangers for authority.',
        'Never invent citations, ordinance numbers, or promises about sightings. Keep total reply roughly under 280 words unless they explicitly requested depth.',
        'Stay on Bwindi / SIGTS visitor themes; politely decline unrelated topics.',
        locHint,
        utcNote ? `Server UTC hint: ${utcNote}` : '',
        knowledgePack ? `KNOWLEDGE BASE:\n${knowledgePack}` : '(No DB rows tightly matched—still help with sober general Bwindi visitor etiquette.)',
        '',
        `Clock (UTC ISO) for pacing context only: ${serverTimeISO}`,
    ]
        .filter(Boolean)
        .join('\n');
}

async function resolveLocationName(lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
        return null;
    }

    try {
        const result = await pool.query(
            `SELECT name
             FROM locations
             ORDER BY coordinates <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
             LIMIT 1`,
            [lng, lat]
        );
        return result.rows[0]?.name || null;
    } catch (error) {
        return null;
    }
}

router.get('/status', (_req, res) => {
    const env = readChatEnv();
    res.json({
        success: true,
        llm_configured: isLLMConfigured(),
        model: env.model,
        provider: env.baseUrl,
        max_tokens: env.maxTokens,
        grounding: [
            'parks',
            'faqs',
            'safety_tips',
            'destination_info',
            'animals',
            'wildlife_tour_themes',
            'cultural_narratives',
            'locations',
            'tour_content',
            'tour_routes',
            'sightings',
        ],
    });
});

router.post('/chat', [
    body('question').isString().isLength({ min: 2, max: 2000 }),
    body('location.lat').optional().isFloat({ min: -90, max: 90 }),
    body('location.lng').optional().isFloat({ min: -180, max: 180 }),
    body('language').optional().isString().isLength({ min: 2, max: 5 }),
    body('client_time').optional().isString().isLength({ max: 64 }),
    body('history').optional().isArray({ max: 24 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const question = req.body.question.trim();
    const lat = req.body?.location?.lat;
    const lng = req.body?.location?.lng;
    const language = req.body.language || req.user.language_pref || 'en';
    const appContext = sanitizeAppContext(req.body.app_context);
    const clientTime = typeof req.body.client_time === 'string' ? req.body.client_time.trim().slice(0, 40) : null;
    const history = sanitizeChatHistory(req.body.history);

    const startedAt = Date.now();
    const locationName = await resolveLocationName(lat, lng);
    /** Full thread — never feed this string alone into gorilla/permit shortcuts (assistant echoes contain those words). */
    const mergedThread = history.length ? composeThreadForRules(question, history) : null;
    const rulesQuestionForLlm = mergedThread || question;
    const timeContext = buildServerTimeContextNote();

    let answer;
    let nlp_mode = 'rule_kb_v1';
    let groundingMeta = null;

    const llmEligible = shouldUseLlmForQuestion(question, mergedThread);
    const tryLlm = isLLMConfigured() && llmEligible;

    if (tryLlm) {
        try {
            const retrievalQuery = buildRetrievalQuery(question, history);
            const { text: kbText, used } = await retrieveSigtsKnowledge(retrievalQuery);
            groundingMeta = used;
            const clientSnap = formatClientCatalogueSnapshot(appContext);
            const knowledgePack = [clientSnap.length ? `${clientSnap}\n\n` : '', kbText].join('');

            const systemContent = buildLlmSystemPrompt({
                language,
                locationName,
                knowledgePack,
                serverTimeISO: new Date().toISOString(),
                utcNote: timeContext,
            });

            const messages = [{ role: 'system', content: systemContent }];
            for (const h of history.slice(-10)) {
                messages.push({
                    role: h.role === 'assistant' ? 'assistant' : 'user',
                    content: h.text,
                });
            }
            messages.push({ role: 'user', content: question });

            const { text: llmText } = await completeChat({ messages });
            answer = clampStr(llmText, 3800);
            nlp_mode = 'llm_grounded_v1';
        } catch (err) {
            if (String(err.code) !== 'LLM_DISABLED' && String(err.message) !== 'LLM_DISABLED') {
                logger.warn(`SIGTS /ai/chat LLM fallback: ${err.message || err}`);
            }
            answer = buildRuleBasedAnswer(question, mergedThread, { locationName, appContext });
            nlp_mode = 'rule_kb_v1_fallback';
        }
    } else {
        answer = buildRuleBasedAnswer(question, mergedThread, { locationName, appContext });
    }

    const responseTimeMs = Date.now() - startedAt;
    const sources = deriveAnswerSources(question, answer, appContext, locationName, groundingMeta, nlp_mode);

    try {
        let touristId = null;
        if (req.user.user_type === 'tourist') {
            const touristResult = await pool.query(
                'SELECT tourist_id FROM tourists WHERE user_id = $1 LIMIT 1',
                [req.user.user_id]
            );
            touristId = touristResult.rows[0]?.tourist_id || null;
        }

        await pool.query(
            `INSERT INTO ai_query_logs (query_text, response_text, response_time_ms, language, tourist_id, timestamp)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
            [question, answer, responseTimeMs, language, touristId]
        );
    } catch (error) {
        // Do not fail chat response if analytics logging fails.
    }

    res.json({
        success: true,
        answer,
        meta: {
            response_time_ms: responseTimeMs,
            context_aware: Boolean(locationName),
            location_name: locationName,
            sources,
            server_time: new Date().toISOString(),
            client_time: clientTime,
            time_context: timeContext,
            nlp_mode,
            llm_configured: isLLMConfigured(),
            llm_model: isLLMConfigured() ? readChatEnv().model : null,
            llm_eligible_question: llmEligible,
            history_turns_client: history.length,
            grounding_hits: groundingMeta || null,
        },
    });
});

module.exports = router;
