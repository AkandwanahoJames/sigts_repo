const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateJWT, authorize } = require('../middleware/auth');
const { idempotency } = require('../middleware/idempotency');

// Canonical System Usability Scale (SUS) items. Odd items are positively worded,
// even items are negatively worded — scoring accounts for this below.
const SUS_ITEMS = [
    'I think that I would like to use this system frequently.',
    'I found the system unnecessarily complex.',
    'I thought the system was easy to use.',
    'I think that I would need the support of a technical person to be able to use this system.',
    'I found the various functions in this system were well integrated.',
    'I thought there was too much inconsistency in this system.',
    'I would imagine that most people would learn to use this system very quickly.',
    'I found the system very cumbersome to use.',
    'I felt very confident using the system.',
    'I needed to learn a lot of things before I could get going with this system.'
];

// Minimum distinct testers before aggregated results are treated as decision-grade.
const MIN_RELIABLE_SAMPLE = 5;

function computeSusScore(answers) {
    // answers: array of 10 integers in [1,5]. Returns SUS score in [0,100].
    let total = 0;
    for (let i = 0; i < 10; i += 1) {
        const v = Number(answers[i]);
        // Odd items (index 0,2,4,6,8): contribution = value - 1.
        // Even items (index 1,3,5,7,9): contribution = 5 - value.
        total += i % 2 === 0 ? v - 1 : 5 - v;
    }
    return Math.round(total * 2.5 * 100) / 100;
}

function susGrade(score) {
    if (score == null) return 'Insufficient data';
    if (score >= 80.3) return 'A (Excellent)';
    if (score >= 68) return 'B/C (Good / above average)';
    if (score >= 51) return 'D (OK / below average)';
    return 'F (Poor)';
}

function mean(values) {
    if (!values.length) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values) {
    if (values.length < 2) return 0;
    const m = mean(values);
    const variance = values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1);
    return Math.sqrt(variance);
}

function round2(n) {
    return n == null ? null : Math.round(n * 100) / 100;
}

// GET /api/uat/instrument — the questionnaire definition (any signed-in tester).
router.get('/instrument', authenticateJWT, (req, res) => {
    res.json({ success: true, items: SUS_ITEMS, minReliableSample: MIN_RELIABLE_SAMPLE });
});

// GET /api/uat/mine — whether the current tester has already submitted.
router.get('/mine', authenticateJWT, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT uat_response_id, sus_score, task_completion_rate, is_anonymous, created_at, updated_at
             FROM uat_responses WHERE user_id = $1 LIMIT 1`,
            [req.user.user_id]
        );
        return res.json({ success: true, response: result.rows[0] || null });
    } catch (error) {
        console.error('Get my UAT response error:', error);
        return res.status(500).json({ error: 'Failed to load UAT response' });
    }
});

// POST /api/uat/responses — submit (or refine) the current tester's UAT response.
router.post(
    '/responses',
    authenticateJWT,
    idempotency({ required: false }),
    [
        body('sus_answers').isArray({ min: 10, max: 10 }),
        body('sus_answers.*').isInt({ min: 1, max: 5 }),
        body('task_results').optional().isArray({ max: 20 }),
        body('comment').optional().isString().isLength({ max: 2000 }),
        body('is_anonymous').optional().isBoolean(),
        body('device').optional().isString().isLength({ max: 255 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = req.user.user_id;
        const role = req.user.user_type || 'tourist';
        const answers = req.body.sus_answers.map((v) => Number(v));
        const susScore = computeSusScore(answers);

        // Normalise task results and compute an objective completion rate server-side.
        let taskResults = [];
        if (Array.isArray(req.body.task_results)) {
            taskResults = req.body.task_results
                .filter((t) => t && typeof t === 'object')
                .map((t) => ({
                    id: String(t.id || '').slice(0, 60),
                    label: String(t.label || '').slice(0, 200),
                    completed: Boolean(t.completed)
                }));
        }
        const taskCompletionRate = taskResults.length
            ? Math.round((taskResults.filter((t) => t.completed).length / taskResults.length) * 10000) / 100
            : null;

        const comment = req.body.comment ? String(req.body.comment).trim() : null;
        const isAnonymous = Boolean(req.body.is_anonymous);
        const device = req.body.device ? String(req.body.device).slice(0, 255) : null;

        try {
            const result = await pool.query(
                `INSERT INTO uat_responses (
                    user_id, role, sus_answers, sus_score, task_results, task_completion_rate,
                    comment, is_anonymous, device, updated_at
                 )
                 VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6, $7, $8, $9, CURRENT_TIMESTAMP)
                 ON CONFLICT (user_id) DO UPDATE SET
                    role = EXCLUDED.role,
                    sus_answers = EXCLUDED.sus_answers,
                    sus_score = EXCLUDED.sus_score,
                    task_results = EXCLUDED.task_results,
                    task_completion_rate = EXCLUDED.task_completion_rate,
                    comment = EXCLUDED.comment,
                    is_anonymous = EXCLUDED.is_anonymous,
                    device = EXCLUDED.device,
                    updated_at = CURRENT_TIMESTAMP
                 RETURNING uat_response_id, sus_score, task_completion_rate, created_at, updated_at`,
                [
                    userId,
                    role,
                    JSON.stringify(answers),
                    susScore,
                    JSON.stringify(taskResults),
                    taskCompletionRate,
                    comment,
                    isAnonymous,
                    device
                ]
            );

            return res.status(201).json({
                success: true,
                response: result.rows[0],
                sus_score: susScore,
                grade: susGrade(susScore)
            });
        } catch (error) {
            console.error('Submit UAT response error:', error);
            return res.status(500).json({ error: 'Failed to submit UAT response' });
        }
    }
);

// GET /api/uat/results — aggregated, decision-grade results (IT manager only).
router.get('/results', authenticateJWT, authorize('it_manager'), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT role, sus_answers, sus_score, task_results, task_completion_rate,
                    comment, is_anonymous, created_at, updated_at
             FROM uat_responses
             ORDER BY updated_at DESC`
        );
        const rows = result.rows;
        const n = rows.length;

        const susScores = rows.map((r) => Number(r.sus_score)).filter((v) => Number.isFinite(v));
        const completionRates = rows
            .map((r) => (r.task_completion_rate == null ? null : Number(r.task_completion_rate)))
            .filter((v) => Number.isFinite(v));

        // Per-item mean & standard deviation across all respondents.
        const perItem = SUS_ITEMS.map((label, idx) => {
            const vals = rows
                .map((r) => {
                    const arr = Array.isArray(r.sus_answers) ? r.sus_answers : [];
                    return Number(arr[idx]);
                })
                .filter((v) => Number.isFinite(v));
            return {
                index: idx + 1,
                label,
                mean: round2(mean(vals)),
                sd: round2(stdDev(vals)),
                responses: vals.length
            };
        });

        // Role breakdown.
        const roleCounts = {};
        rows.forEach((r) => {
            const key = r.role || 'unknown';
            roleCounts[key] = (roleCounts[key] || 0) + 1;
        });

        const recentComments = rows
            .filter((r) => r.comment)
            .slice(0, 30)
            .map((r) => ({
                role: r.is_anonymous ? 'anonymous' : r.role,
                comment: r.comment,
                sus_score: Number(r.sus_score),
                created_at: r.created_at
            }));

        const avgSus = round2(mean(susScores));

        return res.json({
            success: true,
            summary: {
                responses: n,
                min_reliable_sample: MIN_RELIABLE_SAMPLE,
                reliable: n >= MIN_RELIABLE_SAMPLE,
                avg_sus: avgSus,
                sus_sd: round2(stdDev(susScores)),
                sus_min: susScores.length ? Math.min(...susScores) : null,
                sus_max: susScores.length ? Math.max(...susScores) : null,
                grade: n ? susGrade(avgSus) : 'No data yet',
                avg_task_completion: round2(mean(completionRates)),
                role_breakdown: roleCounts
            },
            per_item: perItem,
            recent_comments: recentComments
        });
    } catch (error) {
        console.error('UAT results error:', error);
        return res.status(500).json({ error: 'Failed to load UAT results' });
    }
});

module.exports = router;
