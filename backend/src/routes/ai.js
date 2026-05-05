const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateJWT } = require('../middleware/auth');

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

/** Client-supplied SIGTS catalogue snapshot (tour theme briefings + Animals list). */
function sanitizeAppContext(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return null;
    }
    const out = { themes: [], animals: [] };

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
                tourist_summary_en: clampStr(t.tourist_summary_en, 720)
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
                scientific_name: clampStr(a.scientific_name || a.scientific, 200)
            });
        }
    }

    if (!out.themes.length && !out.animals.length) {
        return null;
    }
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

function buildAnswerFromAppContext(question, appContext, locationName) {
    if (!appContext) return null;
    const q = normalizeTourHelpQuestion(question);
    const mentioned = findMentionedAnimal(q, appContext.animals);
    const wantAnimals = Boolean(appContext.animals?.length && (wantsAnimalCatalogContext(q) || mentioned));
    const wantThemes = Boolean(appContext.themes?.length && wantsTourThemeContext(q));

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
        parts.push(`Animals catalogue on this device currently lists ${n} species.`);
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

function buildRuleBasedAnswer(question, context = {}) {
    const q = normalizeTourHelpQuestion(question);
    const { locationName, appContext } = context;

    if (q.includes('gorilla')) {
        return `Mountain gorillas are one of Bwindi's flagship species. Keep a minimum distance of 7 meters, avoid flash photography, and follow your guide's instructions at all times.${locationName ? ` You are currently near ${locationName}.` : ''}`;
    }
    if (q.includes('safety') || q.includes('safe')) {
        return `Safety guidelines: stay on marked trails, keep safe wildlife distance, move in groups when possible, and report emergencies immediately to park rangers.${locationName ? ` Current nearby landmark: ${locationName}.` : ''}`;
    }
    if (q.includes('weather') || q.includes('rain')) {
        return 'Bwindi conditions can change quickly. Carry a light rain layer, water, and non-slip hiking footwear for both dry and wet seasons.';
    }
    if (q.includes('culture') || q.includes('batwa')) {
        return 'Bwindi offers verified cultural narratives and Batwa heritage stories. You can open the Culture module to explore storyteller-approved content.';
    }
    if (q.includes('route') || q.includes('map') || q.includes('direction')) {
        return `Routes and POIs: use the Map screen in SIGTS.${locationName ? ` Latest fix near ${locationName} (landmark name only; verify on the ground).` : ''}`;
    }

    const fromCatalogue = buildAnswerFromAppContext(question, appContext, locationName);
    if (fromCatalogue) {
        return fromCatalogue;
    }

    if (!looksClearlyOffTopic(q) && (isBwindiParkContextQuery(q) || isNatureTourismTopic(q))) {
        return buildBwindiScopedAnswer(question, locationName, appContext);
    }

    return `I can only answer SIGTS/Bwindi topics. Rephrase your question with a specific park topic (for example: gorillas, permits, weather, map route, culture, or species).${locationName ? ` Nearby label: ${locationName}.` : ''}`;
}

function buildServerTimeContextNote() {
    const h = new Date().getUTCHours();
    if (h < 6) return 'UTC night window: confirm local briefing times with your lodge and UWA schedule.';
    if (h < 12) return 'UTC morning: early gates and mist layers are common—sync boots and rain shells before leaving.';
    if (h < 17) return 'UTC midday: pace hydration on climbs; canopy shade vs ridge sun can differ sharply.';
    return 'UTC evening: plan margin for slower exits on muddy descents.';
}

function deriveAnswerSources(question, answer, appContext, locationName) {
    const sources = ['SIGTS curated Bwindi interpreter (rule + knowledge paths)'];
    if (locationName) {
        sources.push(`Locations dataset — nearest mapped label: ${locationName}`);
    }
    if (appContext?.animals?.length) {
        sources.push(`Client Animals catalogue snapshot (${appContext.animals.length} species)`);
    }
    if (appContext?.themes?.length) {
        sources.push(`Client wildlife tour theme briefings (${appContext.themes.length} sessions)`);
    }
    const a = String(answer || '').toLowerCase();
    if (a.includes('unesco') || a.includes('heritage')) sources.push('UNESCO list 682 framing (public summary)');
    if (a.includes('uwa') || a.includes('permit')) sources.push('Uganda Wildlife Authority visitor conduct norms (general)');
    if (a.includes('catalogue') || a.includes('species')) sources.push('On-device biodiversity catalogue');
    return sources;
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

router.post('/chat', [
    body('question').isString().isLength({ min: 2, max: 2000 }),
    body('location.lat').optional().isFloat({ min: -90, max: 90 }),
    body('location.lng').optional().isFloat({ min: -180, max: 180 }),
    body('language').optional().isString().isLength({ min: 2, max: 5 }),
    body('client_time').optional().isString().isLength({ max: 64 })
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

    const startedAt = Date.now();
    const locationName = await resolveLocationName(lat, lng);
    const answer = buildRuleBasedAnswer(question, { locationName, appContext });
    const responseTimeMs = Date.now() - startedAt;
    const sources = deriveAnswerSources(question, answer, appContext, locationName);
    const timeContext = buildServerTimeContextNote();

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
            nlp_mode: 'rule_kb_v1'
        }
    });
});

module.exports = router;
