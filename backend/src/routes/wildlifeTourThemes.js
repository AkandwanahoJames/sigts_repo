// Public read model for UNESCO-aligned wildlife theme session briefings (Animals tab tiles).
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

const SLUG_RE = /^[a-z0-9_]+$/;

function mapThemeRow(row) {
    if (!row) return null;
    return {
        theme_id: row.theme_id,
        slug: row.slug,
        session_title: row.session_title,
        subtitle: row.subtitle,
        tourist_summary_en: row.tourist_summary_en,
        guide_script_en: row.guide_script_en,
        talking_points: row.talking_points || [],
        safety_notes: row.safety_notes,
        etiquette_notes: row.etiquette_notes,
        suggested_duration_minutes: row.suggested_duration_minutes,
        unesco_note: row.unesco_note,
        image_url: row.image_url,
        sort_order: row.sort_order
    };
}

// GET /api/wildlife-tour-themes — ordered tiles for offline cache + UI hints
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT theme_id, slug, session_title, subtitle, tourist_summary_en,
                    guide_script_en, talking_points, safety_notes, etiquette_notes,
                    suggested_duration_minutes, unesco_note, image_url, sort_order
             FROM wildlife_tour_themes
             ORDER BY sort_order ASC, slug ASC`
        );
        res.json({ themes: result.rows.map(mapThemeRow) });
    } catch (error) {
        if (String(error.message || '').includes('does not exist')) {
            return res.status(503).json({ error: 'wildlife_tour_themes table missing; run migration 009.' });
        }
        console.error('List wildlife tour themes error:', error);
        res.status(500).json({ error: 'Failed to fetch tour theme briefings' });
    }
});

// GET /api/wildlife-tour-themes/:slug — full card payload for modal/session view
router.get('/:slug', async (req, res) => {
    const raw = String(req.params.slug || '').trim().toLowerCase();
    if (!SLUG_RE.test(raw)) {
        return res.status(400).json({ error: 'Invalid theme slug' });
    }

    try {
        const result = await pool.query(
            `SELECT theme_id, slug, session_title, subtitle, tourist_summary_en,
                    guide_script_en, talking_points, safety_notes, etiquette_notes,
                    suggested_duration_minutes, unesco_note, image_url, sort_order
             FROM wildlife_tour_themes
             WHERE slug = $1`,
            [raw]
        );
        const theme = result.rows[0];
        if (!theme) {
            return res.status(404).json({ error: 'Tour theme briefing not found' });
        }
        res.json({ theme: mapThemeRow(theme) });
    } catch (error) {
        if (String(error.message || '').includes('does not exist')) {
            return res.status(503).json({ error: 'wildlife_tour_themes table missing; run migration 009.' });
        }
        console.error('Get wildlife tour theme error:', error);
        res.status(500).json({ error: 'Failed to fetch tour theme briefing' });
    }
});

module.exports = router;
