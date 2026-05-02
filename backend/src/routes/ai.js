const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateJWT } = require('../middleware/auth');

router.use(authenticateJWT);

function buildRuleBasedAnswer(question, context = {}) {
    const q = (question || '').toLowerCase();
    const { locationName } = context;

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

    return `Short answers only: wildlife, trekking safety, culture tab content, maps, park hours. Narrow the question for something useful.${locationName ? ` Nearby label in data: ${locationName}. Confirm with your guide.` : ''}`;
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
    body('language').optional().isString().isLength({ min: 2, max: 5 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const question = req.body.question.trim();
    const lat = req.body?.location?.lat;
    const lng = req.body?.location?.lng;
    const language = req.body.language || req.user.language_pref || 'en';

    const startedAt = Date.now();
    const locationName = await resolveLocationName(lat, lng);
    const answer = buildRuleBasedAnswer(question, { locationName });
    const responseTimeMs = Date.now() - startedAt;

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
            location_name: locationName
        }
    });
});

module.exports = router;
