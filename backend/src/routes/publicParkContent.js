/**
 * Tourist-facing catalogue reads (§3.1.1.3): FAQs, safety, park guide, weather hooks, catalog freshness.
 */
const express = require('express');
const { query, validationResult, param } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateJWT } = require('../middleware/auth');
const {
    SOURCE_URL,
    GORILLA_GOLDEN_RULES,
    TOURIST_SPECIES,
    TRAIL_REMINDERS
} = require('../data/touristBiodiversityManifest');
const stayingSafeGuide = require('../data/stayingSafeGuideManifest');

const router = express.Router();

// --- FAQs ---
router.get(
    '/faqs',
    [query('category').optional().isString().trim().isLength({ max: 80 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const category = req.query.category;
        try {
            let sql = `
                SELECT faq_id, question_en, question_local, answer_en, answer_local,
                       category, view_count, helpful_count, sort_order, updated_at
                FROM faqs
                WHERE is_published = true
            `;
            const params = [];
            if (category) {
                sql += ` AND category = $1`;
                params.push(category);
            }
            sql += ` ORDER BY sort_order ASC NULLS LAST, question_en ASC`;
            const result = await pool.query(sql, params);
            res.json({ faqs: result.rows });
        } catch (e) {
            console.error('List FAQs error:', e);
            res.status(500).json({ error: 'Failed to load FAQs' });
        }
    }
);

router.post(
    '/faqs/:id/helpful',
    authenticateJWT,
    [param('id').isUUID()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const up = await pool.query(
                `UPDATE faqs
                 SET helpful_count = helpful_count + 1, updated_at = CURRENT_TIMESTAMP
                 WHERE faq_id = $1 AND is_published = true
                 RETURNING faq_id, helpful_count`,
                [req.params.id]
            );
            if (!up.rows.length) return res.status(404).json({ error: 'FAQ not found' });
            res.json({ success: true, helpful_count: up.rows[0].helpful_count });
        } catch (e) {
            console.error('FAQ helpful error:', e);
            res.status(500).json({ error: 'Could not record feedback' });
        }
    }
);

// --- Safety tips ---
router.get(
    '/safety-tips',
    [query('category').optional().isString().trim().isLength({ max: 80 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        const category = req.query.category;
        try {
            let sql = `
                SELECT tip_id, title, content, category, priority, updated_at
                FROM safety_tips
                WHERE is_active = true
            `;
            const params = [];
            if (category) {
                sql += ` AND category = $1`;
                params.push(category);
            }
            sql += ` ORDER BY priority ASC NULLS LAST, title ASC`;
            const result = await pool.query(sql, params);
            res.json({ tips: result.rows });
        } catch (e) {
            console.error('Safety tips error:', e);
            res.status(500).json({ error: 'Failed to load safety tips' });
        }
    }
);

// --- Destination / park practicals (structured categories) ---
router.get(
    '/park-guide',
    [query('category').optional().isString().trim().isLength({ max: 80 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        const category = req.query.category;
        try {
            let sql = `
                SELECT destinfo_id, category, title, content_en, content_local, image_url,
                       last_updated, is_emergency, sort_order
                FROM destination_info
                WHERE is_active = true
            `;
            const params = [];
            if (category) {
                sql += ` AND category = $1`;
                params.push(category);
            }
            sql += ` ORDER BY is_emergency DESC, sort_order ASC NULLS LAST, title ASC`;
            const result = await pool.query(sql, params);
            res.json({ items: result.rows });
        } catch (e) {
            console.error('Park guide error:', e);
            res.status(500).json({ error: 'Failed to load park guide' });
        }
    }
);

/** Demo-friendly weather capsule for map area (~Bwindi). Replace with MET Norway / Open-Meteo in production. */
function buildWeatherDemo() {
    const now = Date.now();
    const baseTemp = 16 + Math.sin(now / 86400000) * 2;
    const hours = [];
    for (let h = 0; h < 24; h += 3) {
        hours.push({
            hourOffset: h,
            tempC: Math.round((baseTemp + Math.sin((h + now / 3600000) / 12) * 3) * 10) / 10,
            rainProbabilityPct: Math.max(15, Math.min(85, Math.round(40 + 35 * Math.sin((h + 3) / 5))))
        });
    }
    return {
        label: 'Bwindi Impenetrable NP (estimated)',
        temperatureC: Math.round(baseTemp * 10) / 10,
        condition: hours[0].rainProbabilityPct > 55 ? 'Rain likely' : 'Partly cloudy / mist',
        humidityPct: Math.round(72 + Math.sin(now / 5e8) * 8),
        rainProbabilityPct: hours[0].rainProbabilityPct,
        forecastSlices: hours
    };
}

router.get('/weather', async (_req, res) => {
    try {
        const data = buildWeatherDemo();
        res.json({ success: true, data });
    } catch (e) {
        console.error('Weather error:', e);
        res.status(500).json({ error: 'Weather unavailable', success: false });
    }
});

/** Full staying-safe travel guide (sections, packing, FAQs, tips, park guide rows). */
router.get('/staying-safe-guide', async (_req, res) => {
    try {
        const [faqRes, tipRes, guideRes] = await Promise.all([
            pool.query(
                `SELECT faq_id, question_en, answer_en, category, helpful_count, sort_order
                 FROM faqs
                 WHERE is_published = true
                   AND (category LIKE 'staying_safe_%' OR category IN ('health', 'packing', 'preparation', 'wildlife', 'trekking'))
                 ORDER BY sort_order ASC NULLS LAST, question_en ASC`
            ),
            pool.query(
                `SELECT tip_id, title, content, category, priority
                 FROM safety_tips
                 WHERE is_active = true
                 ORDER BY priority ASC NULLS LAST, title ASC`
            ),
            pool.query(
                `SELECT destinfo_id, category, title, content_en, is_emergency, sort_order
                 FROM destination_info
                 WHERE is_active = true
                   AND (
                     title ILIKE '%staying safe%'
                     OR title ILIKE '%packing%'
                     OR title ILIKE '%gorilla%'
                     OR title ILIKE '%trail%'
                     OR title ILIKE '%evacuation%'
                     OR title ILIKE '%kampala%'
                     OR title ILIKE '%transport%'
                     OR title ILIKE '%health checklist%'
                     OR title ILIKE '%UWA guide%'
                     OR title ILIKE '%Golden rules%'
                   )
                 ORDER BY sort_order ASC NULLS LAST, title ASC`
            )
        ]);

        res.json({
            source_url: stayingSafeGuide.SOURCE_URL,
            title: stayingSafeGuide.TITLE,
            intro: stayingSafeGuide.INTRO,
            recap: stayingSafeGuide.RECAP_ITEMS,
            sections: stayingSafeGuide.SECTIONS,
            packing: stayingSafeGuide.PACKING,
            gorilla_golden_rules: GORILLA_GOLDEN_RULES,
            faqs: faqRes.rows,
            safety_tips: tipRes.rows,
            park_guide: guideRes.rows
        });
    } catch (e) {
        console.error('Staying safe guide error:', e);
        res.status(500).json({ error: 'Failed to load staying safe guide' });
    }
});

/** Public park POIs for map tab (no auth — cached by the SPA). */
router.get('/locations/public', async (_req, res) => {
    try {
        const result = await pool.query(
            `SELECT location_id, name, location_type,
                    ST_X(coordinates::geometry) AS longitude,
                    ST_Y(coordinates::geometry) AS latitude,
                    description, trigger_radius, facilities, best_viewing_time
             FROM locations
             ORDER BY name ASC
             LIMIT 120`
        );
        res.json({ locations: result.rows, total: result.rowCount });
    } catch (e) {
        console.error('Public locations error:', e);
        res.status(500).json({ error: 'Failed to load public locations' });
    }
});

/** Tourist-facing trek routes with GeoJSON geometry for the map tab. */
router.get('/routes/public', async (_req, res) => {
    try {
        const routesRes = await pool.query(
            `SELECT route_id, name, description, distance_km, duration_hours, difficulty, elevation_profile,
                    ST_AsGeoJSON(path_geometry)::json AS path_geometry
             FROM tour_routes
             ORDER BY name ASC`
        );

        const stopsRes = await pool.query(
            `SELECT rl.route_id, rl.stop_order, rl.estimated_time_from_prev, rl.stop_duration, rl.points_of_interest,
                    l.location_id, l.name AS location_name, l.location_type,
                    ST_Y(l.coordinates::geometry) AS lat,
                    ST_X(l.coordinates::geometry) AS lng
             FROM route_locations rl
             JOIN locations l ON l.location_id = rl.location_id
             ORDER BY rl.route_id, rl.stop_order ASC`
        );

        const stopsByRoute = new Map();
        for (const row of stopsRes.rows) {
            const key = row.route_id;
            if (!stopsByRoute.has(key)) stopsByRoute.set(key, []);
            stopsByRoute.get(key).push({
                stop_order: row.stop_order,
                location_id: row.location_id,
                location_name: row.location_name,
                location_type: row.location_type,
                lat: row.lat,
                lng: row.lng,
                estimated_time_from_prev: row.estimated_time_from_prev,
                stop_duration: row.stop_duration,
                points_of_interest: row.points_of_interest
            });
        }

        const routes = routesRes.rows.map((row) => ({
            route_id: row.route_id,
            name: row.name,
            description: row.description,
            distance_km: row.distance_km,
            duration_hours: row.duration_hours,
            difficulty: row.difficulty,
            elevation_profile: row.elevation_profile,
            path_geometry: row.path_geometry,
            stops: stopsByRoute.get(row.route_id) || []
        }));

        res.json({
            source_url: SOURCE_URL,
            routes,
            route_count: routes.length
        });
    } catch (e) {
        console.error('Public routes error:', e);
        res.status(500).json({ error: 'Failed to load trek routes' });
    }
});

/** Tourist biodiversity + staying-safe wildlife (photos from animals catalogue). */
router.get('/tourist-biodiversity', async (_req, res) => {
    try {
        const names = TOURIST_SPECIES.map((s) => s.name);
        const result = await pool.query(
            `SELECT animal_id, name, scientific_name, description, conservation_status,
                    habitat, diet, lifespan, image_urls, fun_facts
             FROM animals
             WHERE name = ANY($1::text[])`,
            [names]
        );
        const byName = new Map(result.rows.map((row) => [row.name, row]));

        const species = TOURIST_SPECIES.map((entry, index) => {
            const animal = byName.get(entry.name) || { name: entry.name };
            return {
                sort_order: index + 1,
                group: entry.group,
                group_label: entry.group_label,
                safety_tip: entry.safety_tip,
                animal_id: animal.animal_id || null,
                name: animal.name || entry.name,
                scientific_name: animal.scientific_name || null,
                description: animal.description || null,
                conservation_status: animal.conservation_status || null,
                habitat: animal.habitat || null,
                image_urls: animal.image_urls || [],
                fun_facts: animal.fun_facts || []
            };
        });

        const groups = [];
        const seen = new Set();
        for (const row of species) {
            if (seen.has(row.group)) continue;
            seen.add(row.group);
            groups.push({ id: row.group, label: row.group_label });
        }

        res.json({
            source_url: SOURCE_URL,
            intro:
                'Wildlife and trail reminders from the official Bwindi “Staying Safe” travel guide — gorillas, forest elephants, primates, antelope, snakes/insects, and birding with binoculars.',
            gorilla_golden_rules: GORILLA_GOLDEN_RULES,
            trail_reminders: TRAIL_REMINDERS,
            groups,
            species,
            species_count: species.length
        });
    } catch (e) {
        console.error('Tourist biodiversity error:', e);
        res.status(500).json({ error: 'Failed to load tourist biodiversity' });
    }
});

router.get('/content-catalog-meta', async (_req, res) => {
    try {
        const r = await pool.query(`
            SELECT
                (SELECT COUNT(*)::int FROM animals) AS animal_count,
                (SELECT COUNT(*)::int FROM locations) AS location_count,
                (SELECT MAX(updated_at) FROM animals) AS animals_updated_at,
                (SELECT MAX(updated_at) FROM locations) AS locations_updated_at,
                (SELECT MAX(updated_at) FROM faqs) AS faqs_updated_at,
                (SELECT MAX(updated_at) FROM safety_tips) AS safety_updated_at,
                (SELECT MAX(last_updated) FROM destination_info) AS park_guide_updated_at
        `);
        res.json({
            counts: {
                animals: r.rows[0]?.animal_count || 0,
                locations: r.rows[0]?.location_count || 0
            },
            updated_at: {
                animals: r.rows[0]?.animals_updated_at,
                locations: r.rows[0]?.locations_updated_at,
                faqs: r.rows[0]?.faqs_updated_at,
                safety_tips: r.rows[0]?.safety_updated_at,
                park_guide: r.rows[0]?.park_guide_updated_at
            }
        });
    } catch (e) {
        console.error('catalog meta error:', e);
        res.status(500).json({ error: 'Metadata unavailable' });
    }
});

module.exports = router;
