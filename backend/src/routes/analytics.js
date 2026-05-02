// backend/src/routes/analytics.js
const express = require('express');
const router = express.Router();
const { query, body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateJWT, authorize } = require('../middleware/auth');

router.use(authenticateJWT, authorize('it_manager'));

// =====================================================
// GET /api/analytics/visitor-flow
// Get visitor flow analytics
// =====================================================
router.get('/visitor-flow', [
    query('start').isISO8601(),
    query('end').isISO8601()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { start, end, interval = 'day' } = req.query;

    try {
        // Vanilla Postgres equivalent of TimescaleDB's time_bucket().
        const truncUnit = ['hour', 'day', 'week'].includes(interval) ? interval : 'day';

        const result = await pool.query(
            `SELECT date_trunc($1, arrival_time) as time_period,
                    COUNT(*) as visitor_count,
                    COUNT(DISTINCT tourist_id) as unique_visitors,
                    AVG(duration_minutes) as avg_duration
             FROM visitor_flow
             WHERE arrival_time BETWEEN $2 AND $3
             GROUP BY time_period
             ORDER BY time_period`,
            [truncUnit, start, end]
        );

        const topLocations = await pool.query(
            `SELECT l.name, COUNT(*) as visit_count
             FROM visitor_flow vf
             JOIN locations l ON vf.location_id = l.location_id
             WHERE vf.arrival_time BETWEEN $1 AND $2
             GROUP BY l.location_id, l.name
             ORDER BY visit_count DESC
             LIMIT 10`,
            [start, end]
        );

        res.json({
            timeline: result.rows,
            top_locations: topLocations.rows,
            average_dwell_time: result.rows.reduce((acc, r) => acc + parseFloat(r.avg_duration || 0), 0) / result.rows.length || 0
        });

    } catch (error) {
        console.error('Get visitor flow error:', error);
        res.status(500).json({ error: 'Failed to fetch visitor flow' });
    }
});

// =====================================================
// GET /api/analytics/predictions/congestion
// Get congestion predictions
// =====================================================
router.get('/predictions/congestion', [
    query('date').optional().isDate()
], async (req, res) => {
    const { date = new Date().toISOString().split('T')[0] } = req.query;

    try {
        const predictions = await pool.query(
            `SELECT predicted_hour, predicted_visitor_count,
                    confidence_interval_low, confidence_interval_high
             FROM congestion_predictions
             WHERE predicted_date = $1
             ORDER BY predicted_hour`,
            [date]
        );

        let recommendations = [];

        if (predictions.rows.length > 0) {
            const peakHour = predictions.rows.reduce((a, b) => 
                (a.predicted_visitor_count > b.predicted_visitor_count) ? a : b
            );

            recommendations.push(`Add 2-3 guides between ${peakHour.predicted_hour}:00 - ${peakHour.predicted_hour + 2}:00`);
            
            if (peakHour.predicted_visitor_count > 200) {
                recommendations.push('Prepare overflow parking');
                recommendations.push('Consider opening additional viewing platforms');
            }
        } else {
            recommendations.push('No predictions available for this date');
        }

        res.json({
            date,
            predictions: predictions.rows,
            recommendations
        });

    } catch (error) {
        console.error('Get congestion predictions error:', error);
        res.status(500).json({ error: 'Failed to fetch predictions' });
    }
});

// =====================================================
// GET /api/analytics/popular-content
// Get most viewed content
// =====================================================
router.get('/popular-content', async (req, res) => {
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 10;

    try {
        // No explicit view_count columns yet — derive a "popularity" signal
        // from existing tables so the IT dashboard renders meaningful data.
        // animals: number of sightings observed
        // locations: number of visitor_flow rows
        // cultural narratives: recency (newest first) until we add view tracking
        const animals = await pool.query(
            `SELECT a.name,
                    'animal' AS type,
                    COALESCE(COUNT(s.sighting_id), 0)::int AS view_count
             FROM animals a
             LEFT JOIN sightings s ON s.animal_id = a.animal_id
             GROUP BY a.animal_id, a.name
             ORDER BY view_count DESC, a.name
             LIMIT $1`,
            [limit]
        );

        const locations = await pool.query(
            `SELECT l.name,
                    'location' AS type,
                    COALESCE(COUNT(vf.flow_id), 0)::int AS view_count
             FROM locations l
             LEFT JOIN visitor_flow vf ON vf.location_id = l.location_id
             GROUP BY l.location_id, l.name
             ORDER BY view_count DESC, l.name
             LIMIT $1`,
            [limit]
        );

        const stories = await pool.query(
            `SELECT title_en AS name,
                    'story' AS type,
                    0::int AS view_count
             FROM cultural_narratives
             ORDER BY created_at DESC NULLS LAST, title_en
             LIMIT $1`,
            [limit]
        );

        const allContent = [...animals.rows, ...locations.rows, ...stories.rows]
            .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
            .slice(0, limit);

        res.json(allContent);

    } catch (error) {
        console.error('Get popular content error:', error);
        res.status(500).json({ error: 'Failed to fetch popular content' });
    }
});

// =====================================================
// GET /api/analytics/satisfaction
// Get satisfaction metrics
// =====================================================
router.get('/satisfaction', async (req, res) => {
    try {
        const ratings = await pool.query(
            `SELECT AVG(rating) as avg_rating,
                    COUNT(*) as total_ratings,
                    COUNT(CASE WHEN rating >= 4 THEN 1 END) as satisfied,
                    COUNT(CASE WHEN rating <= 2 THEN 1 END) as dissatisfied
             FROM tour_participants
             WHERE rating IS NOT NULL
               AND feedback_date > NOW() - INTERVAL '90 days'`
        );

        const guideRatings = await pool.query(
            `SELECT AVG(average_rating) as avg_guide_rating
             FROM tour_guides
             WHERE average_rating > 0`
        );

        res.json({
            overall: parseFloat(ratings.rows[0].avg_rating) || 0,
            total_ratings: parseInt(ratings.rows[0].total_ratings),
            satisfaction_rate: ratings.rows[0].total_ratings > 0 
                ? (ratings.rows[0].satisfied / ratings.rows[0].total_ratings * 100).toFixed(1)
                : 0,
            guide_rating: parseFloat(guideRatings.rows[0].avg_guide_rating) || 0
        });

    } catch (error) {
        console.error('Get satisfaction metrics error:', error);
        res.status(500).json({ error: 'Failed to fetch satisfaction metrics' });
    }
});

// =====================================================
// GET /api/analytics/demographics
// Get user demographics
// =====================================================
router.get('/demographics', async (req, res) => {
    try {
        const nationality = await pool.query(
            `SELECT nationality, COUNT(*) as count
             FROM tourists
             WHERE nationality IS NOT NULL
             GROUP BY nationality
             ORDER BY count DESC
             LIMIT 20`
        );

        const ageGroups = await pool.query(
            `SELECT 
                CASE 
                    WHEN date_part('year', age(date_of_birth)) < 18 THEN 'Under 18'
                    WHEN date_part('year', age(date_of_birth)) BETWEEN 18 AND 30 THEN '18-30'
                    WHEN date_part('year', age(date_of_birth)) BETWEEN 31 AND 50 THEN '31-50'
                    ELSE '50+'
                END as age_group,
                COUNT(*) as count
             FROM tourists
             WHERE date_of_birth IS NOT NULL
             GROUP BY age_group
             ORDER BY MIN(date_of_birth)`
        );

        const userTypes = await pool.query(
            `SELECT user_type, COUNT(*) as count
             FROM users
             WHERE is_active = true
             GROUP BY user_type`
        );

        res.json({
            nationality: nationality.rows,
            age_groups: ageGroups.rows,
            user_types: userTypes.rows
        });

    } catch (error) {
        console.error('Get demographics error:', error);
        res.status(500).json({ error: 'Failed to fetch demographics' });
    }
});

// =====================================================
// GET /api/analytics/anomalies — simple z-score style flags (§3.1.1.11)
// =====================================================
router.get('/anomalies', async (req, res) => {
    try {
        const sightings = await pool.query(
            `SELECT DATE_TRUNC('day', timestamp) AS day,
                    COUNT(*)::int AS cnt
             FROM sightings
             WHERE timestamp > NOW() - INTERVAL '120 days'
               AND verification_status = 'verified'
             GROUP BY DATE_TRUNC('day', timestamp)
             ORDER BY day ASC`
        );
        const rows = sightings.rows;
        if (!rows.length) {
            return res.json({ anomalies: [], stats: { baseline_mean: 0, stddev: 0 } });
        }
        const counts = rows.map((r) => r.cnt);
        const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
        const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
        const std = Math.sqrt(variance) || 1;
        const zThresh = Math.max(2, Math.min(4, Number(req.query.z) || 2.5));
        const anomalies = rows
            .map((r) => {
                const z = (r.cnt - mean) / std;
                return { day: r.day, count: r.cnt, zscore: Math.round(z * 100) / 100, high: z > zThresh, low: z < -zThresh };
            })
            .filter((r) => r.high || r.low);
        return res.json({ anomalies, stats: { baseline_mean: mean, stddev: std, z_threshold: zThresh } });
    } catch (error) {
        console.error('analytics anomalies', error);
        res.status(500).json({ error: 'Failed to compute anomalies' });
    }
});

async function tableExists(name) {
    const r = await pool.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        [name]
    );
    return r.rows.length > 0;
}

// =====================================================
// POST /api/analytics/models/retrain-job — queue stub (§3.1.1.11)
// =====================================================
router.post('/models/retrain-job', async (req, res) => {
    const modelKey = String(req.body?.model_key || req.body?.model || 'congestion_v1').slice(0, 160);
    try {
        if (await tableExists('ops_training_jobs')) {
            const ins = await pool.query(
                `INSERT INTO ops_training_jobs (model_key, status, message, created_by)
                 VALUES ($1, 'queued', $2, $3)
                 RETURNING job_id, created_at, status`,
                [modelKey, 'External trainer should poll or pick up this job id.', req.user.user_id]
            );
            return res.status(201).json({ success: true, job: ins.rows[0] });
        }
        const jobId = `local_${Date.now()}`;
        return res.status(201).json({
            success: true,
            job: {
                job_id: jobId,
                model_key: modelKey,
                status: 'queued',
                message: 'Apply migration 011 for persistent training job queue.'
            }
        });
    } catch (error) {
        console.error('retrain job', error);
        res.status(500).json({ error: 'Failed to queue training job' });
    }
});

router.get('/models/retrain-job', async (req, res) => {
    try {
        if (await tableExists('ops_training_jobs')) {
            const r = await pool.query(
                `SELECT job_id, model_key, status, message, created_at, completed_at
                 FROM ops_training_jobs
                 ORDER BY created_at DESC
                 LIMIT 40`
            );
            return res.json({ jobs: r.rows });
        }
        return res.json({ jobs: [] });
    } catch (error) {
        console.error('list retrain jobs', error);
        res.status(500).json({ error: 'Failed to list jobs' });
    }
});

// =====================================================
// POST /api/analytics/reports/build — custom metric bundle (§3.1.1.11)
// =====================================================
router.post('/reports/build', async (req, res) => {
    const metrics = Array.isArray(req.body?.metrics) ? req.body.metrics : ['visitor_flow', 'satisfaction', 'popular_content'];
    const out = { built_at: new Date().toISOString(), sections: {}, section_errors: {} };
    const start = new Date(Date.now() - 14 * 86400000).toISOString();
    const end = new Date().toISOString();

    async function trySection(key, fn) {
        try {
            out.sections[key] = await fn();
        } catch (err) {
            out.section_errors[key] = err.message || 'failed';
        }
    }

    if (metrics.includes('visitor_flow')) {
        await trySection('visitor_flow', async () => {
            const r = await pool.query(
                `SELECT date_trunc('day', arrival_time) AS time_period,
                        COUNT(*) AS visitor_count
                 FROM visitor_flow
                 WHERE arrival_time BETWEEN $1 AND $2
                 GROUP BY time_period
                 ORDER BY time_period`,
                [start, end]
            );
            return r.rows;
        });
    }
    if (metrics.includes('sightings_trend')) {
        await trySection('sightings_trend', async () => {
            const r = await pool.query(
                `SELECT DATE(timestamp) AS day, COUNT(*) AS cnt
                 FROM sightings
                 WHERE timestamp > NOW() - INTERVAL '30 days'
                   AND verification_status = 'verified'
                 GROUP BY DATE(timestamp)
                 ORDER BY day`
            );
            return r.rows;
        });
    }
    if (metrics.includes('satisfaction')) {
        await trySection('satisfaction', async () => {
            const r = await pool.query(
                `SELECT AVG(rating)::float AS avg_rating, COUNT(*) AS n
                 FROM tour_participants WHERE rating IS NOT NULL`
            );
            return r.rows[0];
        });
    }
    if (metrics.includes('popular_content')) {
        await trySection('popular_species', async () => {
            const r = await pool.query(
                `SELECT a.name, COUNT(s.sighting_id)::int AS sightings
                 FROM animals a
                 LEFT JOIN sightings s ON s.animal_id = a.animal_id
                 GROUP BY a.animal_id, a.name
                 ORDER BY sightings DESC
                 LIMIT 8`
            );
            return r.rows;
        });
    }

    return res.json(out);
});

// =====================================================
// Report schedules (§3.1.1.11) — persistence when migration 011 applied
// =====================================================
router.get('/reports/schedules', async (req, res) => {
    try {
        if (!(await tableExists('report_schedules'))) {
            return res.json({ schedules: [], note: 'Migration 011 adds report_schedules table.' });
        }
        const r = await pool.query(
            `SELECT schedule_id, name, cron_expression, metric_keys,
                    email_recipients, enabled, last_run_at, last_report_summary
             FROM report_schedules
             ORDER BY created_at DESC`
        );
        return res.json({ schedules: r.rows });
    } catch (error) {
        console.error('list schedules', error);
        res.status(500).json({ error: 'Failed to load schedules' });
    }
});

router.post(
    '/reports/schedules',
    [
        body('name').optional().isString(),
        body('cron_expression').optional().isString(),
        body('metric_keys').optional().isArray(),
        body('email_recipients').optional().isArray(),
        body('enabled').optional().isBoolean()
    ],
    async (req, res) => {
        try {
            if (!(await tableExists('report_schedules'))) {
                return res.status(503).json({ error: 'report_schedules table missing; apply migration 011.' });
            }
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
            const ins = await pool.query(
                `INSERT INTO report_schedules (name, cron_expression, metric_keys, email_recipients, enabled)
                 VALUES ($1, $2, $3::jsonb, COALESCE($4, ARRAY[]::text[]), COALESCE($5, true))
                 RETURNING *`,
                [
                    req.body.name || 'Scheduled SIGTS analytics report',
                    req.body.cron_expression || '0 9 * * 1',
                    JSON.stringify(Array.isArray(req.body.metric_keys) ? req.body.metric_keys : ['visitor_flow']),
                    req.body.email_recipients || [],
                    req.body.enabled !== false
                ]
            );
            return res.status(201).json({ success: true, schedule: ins.rows[0] });
        } catch (error) {
            console.error('create schedule', error);
            res.status(500).json({ error: 'Failed to create schedule' });
        }
    }
);

router.post('/reports/schedules/:id/run', async (req, res) => {
    try {
        if (!(await tableExists('report_schedules'))) {
            return res.status(503).json({ error: 'report_schedules table missing.' });
        }
        const sid = req.params.id;
        const meta = await pool.query(`SELECT * FROM report_schedules WHERE schedule_id = $1`, [sid]);
        if (!meta.rows.length) return res.status(404).json({ error: 'Schedule not found' });
        const row = meta.rows[0];
        async function safeCount(sql) {
            try {
                const r = await pool.query(sql);
                return r.rows[0]?.n ?? 0;
            } catch (_) {
                return null;
            }
        }
        const [sightingsCt, vfCt, fbCt] = await Promise.all([
            safeCount(`SELECT COUNT(*)::int AS n FROM sightings WHERE verification_status = 'verified'`),
            safeCount(`SELECT COUNT(*)::int AS n FROM visitor_flow WHERE arrival_time > NOW() - INTERVAL '30 days'`),
            safeCount(`SELECT COUNT(*)::int AS n FROM feedback WHERE created_at > NOW() - INTERVAL '30 days'`)
        ]);
        const snap = {
            ran_at: new Date().toISOString(),
            schedule_id: sid,
            metric_keys: row.metric_keys,
            counts: {
                verified_sightings: sightingsCt ?? 0,
                visitor_flow_30d: vfCt,
                feedback_30d: fbCt
            }
        };
        await pool.query(
            `UPDATE report_schedules SET last_run_at = CURRENT_TIMESTAMP, last_report_summary = $2::jsonb WHERE schedule_id = $1`,
            [sid, JSON.stringify(snap)]
        );
        return res.json({
            success: true,
            run: snap,
            note: 'Email delivery plugs into SMTP or a job runner; summaries persist on schedule row.'
        });
    } catch (error) {
        console.error('run schedule', error);
        res.status(500).json({ error: 'Failed to execute schedule manually' });
    }
});

module.exports = router;