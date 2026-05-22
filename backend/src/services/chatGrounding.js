const { pool } = require('../config/database');

function tokenizeQuestion(q) {
    return String(q || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s'-]/g, ' ')
        .split(/\s+/)
        .map((w) => w.replace(/^'+|'+$/g, ''))
        .filter((w) => w.length >= 3)
        .slice(0, 18);
}

async function resolveDefaultParkId() {
    try {
        let r = await pool.query(
            `SELECT park_id FROM parks WHERE name ILIKE '%bwindi%' ORDER BY name ASC LIMIT 1`
        );
        if (r.rows[0]?.park_id) return r.rows[0].park_id;
        r = await pool.query(`SELECT park_id FROM parks ORDER BY name ASC LIMIT 1`);
        return r.rows[0]?.park_id || null;
    } catch (_) {
        return null;
    }
}

function ilikePatterns(terms, question) {
    const p = terms.map((t) => `%${t}%`);
    if (!p.length && question) {
        const s = String(question).slice(0, 160).trim();
        if (s.length >= 2) p.push(`%${s}%`);
    }
    return p;
}

function clampField(value, max) {
    const t = String(value || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    return t.length <= max ? t : `${t.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Always-on park briefing so the LLM has baseline SIGTS facts even when lexical match is weak.
 */
async function retrieveCoreParkBriefing(parkId) {
    const used = { tables: ['parks'], coreBriefing: true };
    let bundle = '## Core SIGTS park briefing (always included)\n';

    try {
        const pr =
            parkId != null
                ? await pool.query(
                      `SELECT name, description, area_sqkm, established_date
                       FROM parks WHERE park_id = $1 LIMIT 1`,
                      [parkId]
                  )
                : await pool.query(
                      `SELECT name, description, area_sqkm, established_date
                       FROM parks WHERE name ILIKE '%bwindi%' ORDER BY name ASC LIMIT 1`
                  );
        const park = pr.rows[0];
        if (park) {
            bundle += `- Park: ${park.name}\n`;
            if (park.description) bundle += `- Overview: ${clampField(park.description, 520)}\n`;
            if (park.area_sqkm) bundle += `- Area (km² in app): ${park.area_sqkm}\n`;
            if (park.established_date) bundle += `- Established: ${park.established_date}\n`;
            bundle += '- UNESCO World Heritage Site (list 682) — montane rainforest biodiversity\n';
        }

        if (parkId) {
            const dr = await pool.query(
                `SELECT category, title, content_en
                 FROM destination_info
                 WHERE park_id = $1 AND COALESCE(is_active, TRUE)
                 ORDER BY is_emergency DESC, sort_order ASC NULLS LAST, last_updated DESC NULLS LAST
                 LIMIT 8`,
                [parkId]
            );
            used.tables.push('destination_info');
            used.coreDestHits = dr.rows.length;
            if (dr.rows.length) {
                bundle += '\n### Key visitor guide rows\n';
                bundle += dr.rows
                    .map((r, i) => `${i + 1}. [${r.category}] ${r.title}: ${clampField(r.content_en, 280)}`)
                    .join('\n');
            }

            const fr = await pool.query(
                `SELECT question_en, answer_en, category
                 FROM faqs
                 WHERE park_id = $1 AND COALESCE(is_published, TRUE)
                 ORDER BY sort_order ASC NULLS LAST, updated_at DESC NULLS LAST
                 LIMIT 6`,
                [parkId]
            );
            used.tables.push('faqs');
            used.coreFaqHits = fr.rows.length;
            if (fr.rows.length) {
                bundle += '\n\n### Representative FAQs\n';
                bundle += fr.rows
                    .map((r, i) => `${i + 1}. Q: ${r.question_en}\n   A: ${clampField(r.answer_en, 220)}`)
                    .join('\n');
            }

            const sr = await pool.query(
                `SELECT title, content, category
                 FROM safety_tips
                 WHERE park_id = $1 AND COALESCE(is_active, TRUE)
                 ORDER BY priority ASC NULLS LAST
                 LIMIT 6`,
                [parkId]
            );
            used.tables.push('safety_tips');
            used.coreSafetyHits = sr.rows.length;
            if (sr.rows.length) {
                bundle += '\n\n### Core safety reminders\n';
                bundle += sr.rows
                    .map((r, i) => `${i + 1}. ${r.title}: ${clampField(r.content, 200)}`)
                    .join('\n');
            }
        }

        const tr = await pool.query(
            `SELECT session_title, subtitle, tourist_summary_en
             FROM wildlife_tour_themes
             ORDER BY sort_order ASC NULLS LAST
             LIMIT 6`
        );
        used.tables.push('wildlife_tour_themes');
        used.coreThemeHits = tr.rows.length;
        if (tr.rows.length) {
            bundle += '\n\n### Tour theme catalogue (headlines)\n';
            bundle += tr.rows
                .map((t, i) => `${i + 1}. ${t.session_title}${t.subtitle ? ` — ${t.subtitle}` : ''}`)
                .join('\n');
        }

        const lr = await pool.query(
            `SELECT name, location_type, description
             FROM locations
             ORDER BY
               CASE location_type
                 WHEN 'gate' THEN 1
                 WHEN 'ranger_post' THEN 2
                 WHEN 'viewpoint' THEN 3
                 ELSE 4
               END,
               name ASC
             LIMIT 14`
        );
        used.tables.push('locations');
        used.coreLocationHits = lr.rows.length;
        if (lr.rows.length) {
            bundle += '\n\n### Map / sector POIs (sample)\n';
            bundle += lr.rows
                .map((l, i) => `${i + 1}. ${l.name} (${l.location_type})${l.description ? `: ${clampField(l.description, 120)}` : ''}`)
                .join('\n');
        }
    } catch (e) {
        used.coreError = String(e.message || e);
    }

    bundle += '\n\nSectors visitors reference: Buhoma, Ruhija, Rushaga, Nkuringo. Permits and live quotas: Uganda Wildlife Authority (UWA), not SIGTS.\n';
    used.tables = [...new Set(used.tables)];
    return { text: bundle.trim(), used };
}

/**
 * Pulls SIGTS rows likely relevant to `question` for LLM grounding (RAG-lite).
 * Returns text block + telemetry about what matched.
 */
async function retrieveSigtsKnowledge(question, opts = {}) {
    const safeQ = String(question || '').slice(0, 4000);
    const terms = tokenizeQuestion(safeQ);
    const patterns = ilikePatterns(terms, safeQ);
    const parkId = await resolveDefaultParkId();
    const hasPatterns = patterns.length > 0;

    const used = {
        tables: [],
        faqHits: 0,
        safetyHits: 0,
        destHits: 0,
        animalHits: 0,
        themeHits: 0,
        cultureHits: 0,
        locationHits: 0,
        tourContentHits: 0,
        routeHits: 0,
        sightingHits: 0,
    };

    const { text: coreText, used: coreUsed } = await retrieveCoreParkBriefing(parkId);
    Object.assign(used, {
        coreBriefing: true,
        coreDestHits: coreUsed.coreDestHits || 0,
        coreFaqHits: coreUsed.coreFaqHits || 0,
        coreSafetyHits: coreUsed.coreSafetyHits || 0,
    });
    used.tables.push(...(coreUsed.tables || []));

    let bundle = `${coreText}\n\n`;

    try {
        if (parkId) {
            const pf = hasPatterns ? patterns : ['%bwindi%', '%gorilla%', '%trek%'];
            const faqLimit = Number(opts.maxFaqs || (hasPatterns ? 8 : 5));
            const fr = await pool.query(
                `SELECT question_en, answer_en, category
                 FROM faqs
                 WHERE park_id = $1 AND COALESCE(is_published, TRUE)
                   AND (
                     ${hasPatterns ? 'question_en ILIKE ANY ($2::text[]) OR answer_en ILIKE ANY ($2::text[])' : 'TRUE'}
                   )
                 ORDER BY sort_order ASC NULLS LAST, updated_at DESC NULLS LAST
                 LIMIT ${faqLimit}`,
                hasPatterns ? [parkId, pf] : [parkId]
            );
            used.tables.push('faqs');
            used.faqHits = fr.rows.length;
            if (fr.rows.length) {
                bundle += '## FAQs matched to this question (SIGTS)\n';
                bundle += fr.rows
                    .map((r, i) => `${i + 1}. Q: ${r.question_en}\n   A: ${clampField(r.answer_en, 360)}${r.category ? ` [${r.category}]` : ''}`)
                    .join('\n');
                bundle += '\n\n';
            }

            const safetyLimit = Number(opts.maxSafety || (hasPatterns ? 8 : 5));
            const sr = await pool.query(
                `SELECT title, content, category, priority
                 FROM safety_tips
                 WHERE park_id = $1 AND COALESCE(is_active, TRUE)
                   AND (${hasPatterns ? 'title ILIKE ANY ($2::text[]) OR content ILIKE ANY ($2::text[])' : 'TRUE'})
                 ORDER BY priority ASC NULLS LAST, updated_at DESC NULLS LAST
                 LIMIT ${safetyLimit}`,
                hasPatterns ? [parkId, pf] : [parkId]
            );
            used.tables.push('safety_tips');
            used.safetyHits = sr.rows.length;
            if (sr.rows.length) {
                bundle += '## Safety tips (SIGTS)\n';
                bundle += sr.rows
                    .map((r, i) => `${i + 1}. ${r.title}${r.category ? ` (${r.category})` : ''}: ${clampField(r.content, 280)}`)
                    .join('\n');
                bundle += '\n\n';
            }

            const destLimit = Number(opts.maxDestination || (hasPatterns ? 8 : 5));
            const dr = await pool.query(
                `SELECT category, title, content_en, is_emergency
                 FROM destination_info
                 WHERE park_id = $1 AND COALESCE(is_active, TRUE)
                   AND (${hasPatterns ? 'title ILIKE ANY ($2::text[]) OR content_en ILIKE ANY ($2::text[])' : 'TRUE'})
                 ORDER BY is_emergency DESC, sort_order ASC NULLS LAST, last_updated DESC NULLS LAST
                 LIMIT ${destLimit}`,
                hasPatterns ? [parkId, pf] : [parkId]
            );
            used.tables.push('destination_info');
            used.destHits = dr.rows.length;
            if (dr.rows.length) {
                bundle += '## Park visitor information (SIGTS)\n';
                bundle += dr.rows
                    .map((r, i) => `${i + 1}. [${r.category}] ${r.title}: ${clampField(r.content_en, 320)}`)
                    .join('\n');
                bundle += '\n\n';
            }
        }

        if (hasPatterns) {
            const ar = await pool.query(
                `SELECT name, scientific_name, conservation_status, description, habitat, diet, lifespan,
                        average_size, gestation_period, social_structure,
                        array_to_string(fun_facts, ' | ') AS fun_facts_text
                 FROM animals
                 WHERE name ILIKE ANY ($1::text[])
                    OR scientific_name ILIKE ANY ($1::text[])
                    OR description ILIKE ANY ($1::text[])
                    OR habitat ILIKE ANY ($1::text[])
                 ORDER BY name ASC
                 LIMIT ${Number(opts.maxAnimals || 8)}`,
                [patterns]
            );
            used.tables.push('animals');
            used.animalHits = ar.rows.length;
            if (ar.rows.length) {
                bundle += '## Species catalogue (SIGTS database)\n';
                for (const a of ar.rows) {
                    bundle += `### ${a.name}${a.scientific_name ? ` (${a.scientific_name})` : ''}\n`;
                    if (a.conservation_status) bundle += `- Status in app: ${a.conservation_status}\n`;
                    if (a.description) bundle += `- ${clampField(a.description, 400)}\n`;
                    if (a.habitat) bundle += `- Habitat: ${a.habitat}\n`;
                    if (a.diet) bundle += `- Diet: ${a.diet}\n`;
                    if (a.social_structure) bundle += `- Social structure: ${a.social_structure}\n`;
                    if (a.fun_facts_text) bundle += `- Fun facts: ${a.fun_facts_text}\n`;
                    bundle += '\n';
                }
            }

            const tr = await pool.query(
                `SELECT session_title, subtitle, tourist_summary_en, safety_notes, etiquette_notes
                 FROM wildlife_tour_themes
                 WHERE session_title ILIKE ANY ($1::text[])
                    OR subtitle ILIKE ANY ($1::text[])
                    OR tourist_summary_en ILIKE ANY ($1::text[])
                 ORDER BY sort_order ASC NULLS LAST
                 LIMIT ${Number(opts.maxThemes || 6)}`,
                [patterns]
            );
            used.tables.push('wildlife_tour_themes');
            used.themeHits = tr.rows.length;
            if (tr.rows.length) {
                bundle += '## Wildlife tour theme briefings (SIGTS)\n';
                bundle += tr.rows
                    .map((t, i) => {
                        let s = `${i + 1}. ${t.session_title}`;
                        if (t.subtitle) s += ` — ${t.subtitle}`;
                        s += `\n   Summary: ${clampField(t.tourist_summary_en, 400)}`;
                        if (t.safety_notes) s += `\n   Safety: ${t.safety_notes}`;
                        if (t.etiquette_notes) s += `\n   Etiquette: ${t.etiquette_notes}`;
                        return s;
                    })
                    .join('\n\n');
                bundle += '\n\n';
            }

            const cr = await pool.query(
                `SELECT narrative_id, title_en, community, story_type, narrative_en, cultural_significance, taboos
                 FROM cultural_narratives
                 WHERE published_at IS NOT NULL
                   AND (
                     title_en ILIKE ANY ($1::text[])
                     OR narrative_en ILIKE ANY ($1::text[])
                     OR cultural_significance ILIKE ANY ($1::text[])
                   )
                 ORDER BY published_at DESC NULLS LAST, title_en ASC
                 LIMIT ${Number(opts.maxCulture || 6)}`,
                [patterns]
            );
            used.tables.push('cultural_narratives');
            used.cultureHits = cr.rows.length;
            if (cr.rows.length) {
                bundle += '## Cultural narratives (SIGTS)\n';
                bundle += cr.rows
                    .map((c, i) => {
                        let s = `${i + 1}. ${c.title_en} (${c.community || 'community'}${c.story_type ? `, ${c.story_type}` : ''})`;
                        s += `\n   Story: ${clampField(c.narrative_en, 380)}`;
                        if (c.cultural_significance) s += `\n   Significance: ${clampField(c.cultural_significance, 200)}`;
                        if (c.taboos) s += `\n   Taboos: ${clampField(c.taboos, 160)}`;
                        return s;
                    })
                    .join('\n\n');
                bundle += '\n\n';
            }

            const lr = await pool.query(
                `SELECT name, location_type, description, best_viewing_time, terrain_type
                 FROM locations
                 WHERE name ILIKE ANY ($1::text[])
                    OR description ILIKE ANY ($1::text[])
                    OR location_type ILIKE ANY ($1::text[])
                 ORDER BY name ASC
                 LIMIT ${Number(opts.maxLocations || 8)}`,
                [patterns]
            );
            used.tables.push('locations');
            used.locationHits = lr.rows.length;
            if (lr.rows.length) {
                bundle += '## Locations / map POIs (SIGTS)\n';
                bundle += lr.rows
                    .map((l, i) => {
                        let s = `${i + 1}. ${l.name} (${l.location_type})`;
                        if (l.description) s += `: ${clampField(l.description, 200)}`;
                        if (l.best_viewing_time) s += ` · Best viewing: ${l.best_viewing_time}`;
                        return s;
                    })
                    .join('\n');
                bundle += '\n\n';
            }

            const tcr = await pool.query(
                `SELECT tc.title_en, tc.content_type, tc.description_en, tc.fun_fact, l.name AS location_name
                 FROM tour_content tc
                 JOIN locations l ON l.location_id = tc.location_id
                 WHERE tc.title_en ILIKE ANY ($1::text[])
                    OR tc.description_en ILIKE ANY ($1::text[])
                    OR tc.fun_fact ILIKE ANY ($1::text[])
                 ORDER BY tc.order_priority ASC NULLS LAST
                 LIMIT ${Number(opts.maxTourContent || 5)}`,
                [patterns]
            );
            used.tables.push('tour_content');
            used.tourContentHits = tcr.rows.length;
            if (tcr.rows.length) {
                bundle += '## Location-linked tour content (SIGTS)\n';
                bundle += tcr.rows
                    .map((t, i) => {
                        let s = `${i + 1}. ${t.title_en} at ${t.location_name}`;
                        if (t.content_type) s += ` [${t.content_type}]`;
                        if (t.description_en) s += `: ${clampField(t.description_en, 220)}`;
                        if (t.fun_fact) s += ` · Fact: ${t.fun_fact}`;
                        return s;
                    })
                    .join('\n');
                bundle += '\n\n';
            }
        }

        try {
            const rr = await pool.query(
                `SELECT tr.name, tr.difficulty, tr.duration_hours, tr.distance_km,
                        array_agg(l.name ORDER BY rl.stop_order) FILTER (WHERE l.name IS NOT NULL) AS stops
                 FROM tour_routes tr
                 LEFT JOIN route_locations rl ON rl.route_id = tr.route_id
                 LEFT JOIN locations l ON l.location_id = rl.location_id
                 GROUP BY tr.route_id, tr.name, tr.difficulty, tr.duration_hours, tr.distance_km
                 ORDER BY tr.name ASC
                 LIMIT ${Number(opts.maxRoutes || 6)}`
            );
            used.tables.push('tour_routes');
            used.routeHits = rr.rows.length;
            if (rr.rows.length && (hasPatterns || /\b(route|trail|hike|trek)\b/i.test(safeQ))) {
                bundle += '## Trek routes in SIGTS (sample)\n';
                bundle += rr.rows
                    .map((r, i) => {
                        const stops = Array.isArray(r.stops) ? r.stops.slice(0, 6).join(' → ') : '';
                        const hrs = r.duration_hours != null ? `${r.duration_hours}h` : '?';
                        return `${i + 1}. ${r.name} (${r.difficulty || 'difficulty n/a'}, ~${hrs})${stops ? ` · Stops: ${stops}` : ''}`;
                    })
                    .join('\n');
                bundle += '\n\n';
            }
        } catch (_) {
            /** routes table optional in some builds */
        }

        if (hasPatterns) {
            const sr = await pool.query(
                `SELECT a.name AS animal_name, l.name AS location_name, s.timestamp, s.notes
                 FROM sightings s
                 JOIN animals a ON a.animal_id = s.animal_id
                 LEFT JOIN locations l ON l.location_id = s.location_id
                 WHERE a.name ILIKE ANY ($1::text[])
                    OR l.name ILIKE ANY ($1::text[])
                    OR s.notes ILIKE ANY ($1::text[])
                 ORDER BY s.timestamp DESC NULLS LAST
                 LIMIT ${Number(opts.maxSightings || 5)}`,
                [patterns]
            );
            used.tables.push('sightings');
            used.sightingHits = sr.rows.length;
            if (sr.rows.length) {
                bundle += '## Recent visitor sightings (SIGTS — anecdotal, not live guarantees)\n';
                bundle += sr.rows
                    .map((s, i) => {
                        const when = s.timestamp ? new Date(s.timestamp).toISOString().slice(0, 10) : 'date n/a';
                        return `${i + 1}. ${s.animal_name}${s.location_name ? ` near ${s.location_name}` : ''} (${when})${s.notes ? `: ${clampField(s.notes, 120)}` : ''}`;
                    })
                    .join('\n');
                bundle += '\n\n';
            }
        }
    } catch (e) {
        used.error = String(e.message || e);
    }

    const text = bundle.trim();
    used.tables = [...new Set(used.tables)];
    return {
        text: text.length ? text : '(No SIGTS rows retrieved.)',
        used,
    };
}

/**
 * Snapshot from the mobile/web client (catalogue + FAQs + map + culture summaries).
 */
function formatClientCatalogueSnapshot(appContext) {
    if (!appContext || typeof appContext !== 'object') return '';
    let out = '';

    if (Array.isArray(appContext.themes) && appContext.themes.length) {
        out += '## Theme summaries from the visitor device\n';
        for (const t of appContext.themes.slice(0, 12)) {
            const title = t.session_title || t.slug || 'Session';
            out += `- ${title}${t.subtitle ? `: ${t.subtitle}` : ''}\n`;
            if (t.tourist_summary_en) out += `  ${clampField(t.tourist_summary_en, 400)}\n`;
        }
        out += '\n';
    }

    if (Array.isArray(appContext.animals) && appContext.animals.length) {
        out += `## Species names on device (${appContext.animals.length} in catalogue)\n`;
        out += appContext.animals
            .slice(0, 48)
            .map((a) => `- ${a.name}${a.scientific_name ? ` (${a.scientific_name})` : ''}`)
            .join('\n');
        out += '\n\n';
    }

    if (Array.isArray(appContext.locations) && appContext.locations.length) {
        out += '## Map POIs on device\n';
        out += appContext.locations
            .slice(0, 24)
            .map((l) => `- ${l.name} (${l.location_type || 'poi'})${l.description ? `: ${clampField(l.description, 100)}` : ''}`)
            .join('\n');
        out += '\n\n';
    }

    if (Array.isArray(appContext.stories) && appContext.stories.length) {
        out += '## Cultural stories on device\n';
        out += appContext.stories
            .slice(0, 14)
            .map((s) => `- ${s.title}${s.community ? ` [${s.community}]` : ''}${s.summary ? `: ${clampField(s.summary, 160)}` : ''}`)
            .join('\n');
        out += '\n\n';
    }

    if (Array.isArray(appContext.faqs) && appContext.faqs.length) {
        out += '## FAQs cached on device\n';
        out += appContext.faqs
            .slice(0, 12)
            .map((f, i) => `${i + 1}. Q: ${f.question}\n   A: ${clampField(f.answer, 200)}`)
            .join('\n');
        out += '\n\n';
    }

    if (Array.isArray(appContext.safety_species) && appContext.safety_species.length) {
        out += '## Staying-safe species highlights (device)\n';
        out += appContext.safety_species
            .slice(0, 10)
            .map((s) => `- ${s.name}: ${clampField(s.safety_tip, 200)}`)
            .join('\n');
        out += '\n\n';
    }

    if (appContext.weather && typeof appContext.weather === 'object') {
        const w = appContext.weather;
        out += '## Weather capsule (SIGTS map area estimate)\n';
        out += `- ${w.condition || 'n/a'}, ~${w.temperatureC ?? '—'}°C, rain ~${w.rainProbabilityPct ?? '—'}%\n\n`;
    }

    if (appContext.catalog_meta && typeof appContext.catalog_meta === 'object') {
        const c = appContext.catalog_meta;
        out += `## Catalogue freshness on device: ${c.animals ?? '?'} animals, ${c.locations ?? '?'} locations\n\n`;
    }

    return out.trim();
}

module.exports = {
    retrieveSigtsKnowledge,
    retrieveCoreParkBriefing,
    formatClientCatalogueSnapshot,
    tokenizeQuestion,
};
