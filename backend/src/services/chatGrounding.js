const { pool } = require('../config/database');

function tokenizeQuestion(q) {
    return String(q || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s'-]/g, ' ')
        .split(/\s+/)
        .map((w) => w.replace(/^'+|'+$/g, ''))
        .filter((w) => w.length >= 3)
        .slice(0, 14);
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

/**
 * Pulls SIGTS rows likely relevant to `question` for LLM grounding (RAG-lite).
 * Returns text block + telemetry about what matched.
 */
async function retrieveSigtsKnowledge(question, opts = {}) {
    const safeQ = String(question || '').slice(0, 2000);
    const terms = tokenizeQuestion(safeQ);
    const patterns = ilikePatterns(terms, safeQ);
    const parkId = await resolveDefaultParkId();

    const used = { tables: [], faqHits: 0, safetyHits: 0, destHits: 0, animalHits: 0, themeHits: 0 };

    let bundle = '';

    try {
        if (parkId && patterns.length) {
            const pf = patterns;
            const fr = await pool.query(
                `SELECT question_en, answer_en, category
                 FROM faqs
                 WHERE park_id = $1 AND COALESCE(is_published, TRUE)
                   AND (
                     question_en ILIKE ANY ($2::text[])
                     OR answer_en ILIKE ANY ($2::text[])
                   )
                 ORDER BY sort_order ASC NULLS LAST, updated_at DESC NULLS LAST
                 LIMIT ${Number(opts.maxFaqs || 6)}`,
                [parkId, pf]
            );
            used.tables.push('faqs');
            used.faqHits = fr.rows.length;
            if (fr.rows.length) {
                bundle += '## FAQs (verified in SIGTS)\n';
                bundle += fr.rows
                    .map((r, i) => `${i + 1}. Q: ${r.question_en}\n   A: ${r.answer_en}${r.category ? ` [${r.category}]` : ''}`)
                    .join('\n');
                bundle += '\n\n';
            }

            const sr = await pool.query(
                `SELECT title, content, category, priority
                 FROM safety_tips
                 WHERE park_id = $1 AND COALESCE(is_active, TRUE)
                   AND (title ILIKE ANY ($2::text[]) OR content ILIKE ANY ($2::text[]))
                 ORDER BY priority ASC NULLS LAST, updated_at DESC NULLS LAST
                 LIMIT ${Number(opts.maxSafety || 6)}`,
                [parkId, pf]
            );
            used.tables.push('safety_tips');
            used.safetyHits = sr.rows.length;
            if (sr.rows.length) {
                bundle += '## Safety tips (verified in SIGTS)\n';
                bundle += sr.rows
                    .map((r, i) => `${i + 1}. ${r.title}${r.category ? ` (${r.category})` : ''}: ${r.content}`)
                    .join('\n');
                bundle += '\n\n';
            }

            const dr = await pool.query(
                `SELECT category, title, content_en
                 FROM destination_info
                 WHERE park_id = $1 AND COALESCE(is_active, TRUE)
                   AND (title ILIKE ANY ($2::text[]) OR content_en ILIKE ANY ($2::text[]))
                 ORDER BY is_emergency DESC, sort_order ASC NULLS LAST, last_updated DESC NULLS LAST
                 LIMIT ${Number(opts.maxDestination || 6)}`,
                [parkId, pf]
            );
            used.tables.push('destination_info');
            used.destHits = dr.rows.length;
            if (dr.rows.length) {
                bundle += '## Park visitor information (verified in SIGTS)\n';
                bundle += dr.rows
                    .map((r, i) => `${i + 1}. [${r.category}] ${r.title}: ${r.content_en}`)
                    .join('\n');
                bundle += '\n\n';
            }
        }

        if (patterns.length) {
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
                 LIMIT ${Number(opts.maxAnimals || 6)}`,
                [patterns]
            );
            used.tables.push('animals');
            used.animalHits = ar.rows.length;
            if (ar.rows.length) {
                bundle += '## Species catalogue (SIGTS database)\n';
                for (const a of ar.rows) {
                    bundle += `### ${a.name}${a.scientific_name ? ` (${a.scientific_name})` : ''}\n`;
                    if (a.conservation_status) bundle += `- IUCN-style status in app: ${a.conservation_status}\n`;
                    if (a.description) bundle += `- ${a.description}\n`;
                    if (a.habitat) bundle += `- Habitat: ${a.habitat}\n`;
                    if (a.diet) bundle += `- Diet: ${a.diet}\n`;
                    if (a.lifespan) bundle += `- Lifespan: ${a.lifespan}\n`;
                    if (a.average_size) bundle += `- Size: ${a.average_size}\n`;
                    if (a.social_structure) bundle += `- Social structure: ${a.social_structure}\n`;
                    if (a.fun_facts_text) bundle += `- Fun facts: ${a.fun_facts_text}\n`;
                    bundle += '\n';
                }
            }
        }

        if (patterns.length) {
            const tr = await pool.query(
                `SELECT session_title, subtitle, tourist_summary_en, safety_notes, etiquette_notes
                 FROM wildlife_tour_themes
                 WHERE session_title ILIKE ANY ($1::text[])
                    OR subtitle ILIKE ANY ($1::text[])
                    OR tourist_summary_en ILIKE ANY ($1::text[])
                 ORDER BY sort_order ASC NULLS LAST
                 LIMIT ${Number(opts.maxThemes || 5)}`,
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
                        s += `\n   Summary: ${t.tourist_summary_en}`;
                        if (t.safety_notes) s += `\n   Safety: ${t.safety_notes}`;
                        if (t.etiquette_notes) s += `\n   Etiquette: ${t.etiquette_notes}`;
                        return s;
                    })
                    .join('\n\n');
                bundle += '\n\n';
            }
        }
    } catch (e) {
        used.error = String(e.message || e);
    }

    const text = bundle.trim();
    used.tables = [...new Set(used.tables)];
    return { text: text.length ? text : '(No closely matching rows were retrieved from FAQs, tips, guides, themes, or species for this wording.)', used };
}

/**
 * Snapshot from the mobile/web client (may overlap DB themes list).
 */
function formatClientCatalogueSnapshot(appContext) {
    if (!appContext || typeof appContext !== 'object') return '';
    let out = '';
    if (Array.isArray(appContext.themes) && appContext.themes.length) {
        out += '## Theme summaries from the visitor device (overlap with CMS may occur)\n';
        for (const t of appContext.themes.slice(0, 12)) {
            const title = t.session_title || t.slug || 'Session';
            out += `- ${title}${t.subtitle ? `: ${t.subtitle}` : ''}\n`;
            if (t.tourist_summary_en) out += `  ${t.tourist_summary_en}\n`;
        }
        out += '\n';
    }
    if (Array.isArray(appContext.animals) && appContext.animals.length) {
        out += '## Species names from the visitor device catalogue\n';
        out += appContext.animals
            .slice(0, 40)
            .map((a) => `- ${a.name}${a.scientific_name ? ` (${a.scientific_name})` : ''}`)
            .join('\n');
        out += '\n\n';
    }
    return out.trim();
}

module.exports = {
    retrieveSigtsKnowledge,
    formatClientCatalogueSnapshot,
    tokenizeQuestion,
};
