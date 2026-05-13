/**
 * Tourist-facing catalogue reads (§3.1.1.3): FAQs, safety, park guide, weather hooks, catalog freshness.
 */
const express = require('express');
const { query, validationResult, param } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateJWT } = require('../middleware/auth');

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
