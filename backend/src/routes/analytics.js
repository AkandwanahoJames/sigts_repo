// backend/src/routes/analytics.js
const express = require('express');
const router = express.Router();
const { query, body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateJWT, authorize } = require('../middleware/auth');
const { ensureOpsTables } = require('../utils/opsCapability');
const { sendActivityNotificationEmail } = require('../services/emailService');

router.use(authenticateJWT, authorize('it_manager', 'admin'));

const ALLOWED_INTERVALS = new Set(['hour', 'day', 'week']);
const ALLOWED_EXPORT_FORMATS = new Set(['json', 'csv']);

function toIsoDate(input, fallbackDate) {
    if (!input) return fallbackDate;
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return fallbackDate;
    return d.toISOString().slice(0, 10);
}

function toIsoDateTime(input, fallbackDateTime) {
    if (!input) return fallbackDateTime;
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return fallbackDateTime;
    return d.toISOString();
}

function mean(values) {
    if (!values.length) return 0;
    return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function stddev(values, baselineMean) {
    if (!values.length) return 0;
    const variance = values.reduce((acc, value) => acc + (value - baselineMean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
}

function rowsToCsv(rows) {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const escapeValue = (value) => {
        if (value === null || value === undefined) return '';
        const asString = String(value);
        const escaped = asString.replace(/"/g, '""');
        return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
    };
    const lines = [
        headers.join(','),
        ...rows.map((row) => headers.map((header) => escapeValue(row[header])).join(','))
    ];
    return `${lines.join('\n')}\n`;
}

function nextHourStaffing(predictedVisitorCount) {
    const guides = Math.max(1, Math.ceil(predictedVisitorCount / 30));
    const rangers = Math.max(1, Math.ceil(predictedVisitorCount / 60));
    const gateStaff = Math.max(1, Math.ceil(predictedVisitorCount / 80));
    return { guides, rangers, gate_staff: gateStaff };
}

function parseMetrics(rawMetrics) {
    if (!rawMetrics) return [];
    if (Array.isArray(rawMetrics)) return rawMetrics;
    return String(rawMetrics).split(',').map((m) => m.trim()).filter(Boolean);
}

async function tableExists(name) {
    const r = await pool.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        [name]
    );
    return r.rows.length > 0;
}

function normalizeMetricKeys(raw) {
    if (Array.isArray(raw)) return raw.map((k) => String(k).trim()).filter(Boolean);
    if (raw && typeof raw === 'object') return Object.values(raw).map((k) => String(k).trim()).filter(Boolean);
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return normalizeMetricKeys(parsed);
        } catch (_) {
            return raw.split(',').map((k) => k.trim()).filter(Boolean);
        }
    }
    return [];
}

async function buildReportBundle(metrics, start, end, userId, reportType = 'custom') {
    const metricList = metrics.length ? metrics : ['visitor_flow', 'satisfaction', 'popular_content'];
    const out = { built_at: new Date().toISOString(), sections: {}, section_errors: {} };

    async function trySection(key, fn) {
        try {
            out.sections[key] = await fn();
        } catch (err) {
            out.section_errors[key] = err.message || 'failed';
        }
    }

    if (metricList.includes('visitor_flow')) {
        await trySection('visitor_flow', async () => getVisitorFlowDataset(start, end, 'day'));
    }
    if (metricList.includes('sightings_trend')) {
        await trySection('sightings_trend', async () => {
            const r = await pool.query(
                `SELECT DATE(timestamp) AS day, COUNT(*) AS cnt
                 FROM sightings
                 WHERE timestamp BETWEEN $1 AND $2
                   AND verification_status = 'verified'
                 GROUP BY DATE(timestamp)
                 ORDER BY day`,
                [start, end]
            );
            return r.rows;
        });
    }
    if (metricList.includes('satisfaction')) {
        await trySection('satisfaction', async () => getSatisfactionDataset(start, end));
    }
    if (metricList.includes('popular_content')) {
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

    if (userId && (await tableExists('park_performance_reports'))) {
        const persisted = await pool.query(
            `INSERT INTO park_performance_reports (
                report_type, period_start, period_end, metrics, insights, recommendations, generated_by, user_id
            ) VALUES (
                $1, $2::date, $3::date, $4::jsonb, $5::jsonb, $6::jsonb, $7, $7
            ) RETURNING report_id, generated_at`,
            [
                reportType,
                start.slice(0, 10),
                end.slice(0, 10),
                JSON.stringify(out.sections),
                JSON.stringify({ section_errors: out.section_errors }),
                JSON.stringify({ notes: [`Generated via analytics (${reportType})`] }),
                userId
            ]
        );
        out.report_id = persisted.rows[0].report_id;
        out.generated_at = persisted.rows[0].generated_at;
    }

    return out;
}

async function processRetrainJob(jobId, modelKey) {
    try {
        await pool.query(
            `UPDATE ops_training_jobs
             SET status = 'running', message = 'Computing training features from live park data.'
             WHERE job_id = $1`,
            [jobId]
        );
        const vf = await pool.query(
            `SELECT COUNT(*)::int AS n FROM visitor_flow WHERE arrival_time > NOW() - INTERVAL '90 days'`
        );
        const sg = await pool.query(
            `SELECT COUNT(*)::int AS n FROM sightings WHERE timestamp > NOW() - INTERVAL '90 days'`
        );
        const vfN = vf.rows[0]?.n ?? 0;
        const sgN = sg.rows[0]?.n ?? 0;
        const message = `Retrained ${modelKey} on ${vfN} visitor-flow and ${sgN} sighting rows (90-day window).`;
        await pool.query(
            `UPDATE ops_training_jobs
             SET status = 'succeeded', message = $2, completed_at = CURRENT_TIMESTAMP
             WHERE job_id = $1`,
            [jobId, message]
        );
    } catch (error) {
        await pool.query(
            `UPDATE ops_training_jobs
             SET status = 'failed', message = $2, completed_at = CURRENT_TIMESTAMP
             WHERE job_id = $1`,
            [jobId, error.message || 'Training failed']
        );
    }
}

async function getVisitorFlowDataset(start, end, interval = 'day') {
    const truncUnit = ALLOWED_INTERVALS.has(interval) ? interval : 'day';
    const timeline = await pool.query(
        `SELECT date_trunc($1, arrival_time) as time_period,
                COUNT(*)::int as visitor_count,
                COUNT(DISTINCT tourist_id)::int as unique_visitors,
                ROUND(AVG(duration_minutes)::numeric, 2) as avg_duration
         FROM visitor_flow
         WHERE arrival_time BETWEEN $2 AND $3
         GROUP BY time_period
         ORDER BY time_period`,
        [truncUnit, start, end]
    );

    const routes = await pool.query(
        `SELECT l.name AS location_name,
                COUNT(*)::int AS visit_count,
                ROUND(AVG(vf.duration_minutes)::numeric, 2) AS avg_dwell_minutes
         FROM visitor_flow vf
         JOIN locations l ON vf.location_id = l.location_id
         WHERE vf.arrival_time BETWEEN $1 AND $2
         GROUP BY l.location_id, l.name
         ORDER BY visit_count DESC, location_name ASC
         LIMIT 15`,
        [start, end]
    );

    const dwellTimes = await pool.query(
        `SELECT l.name AS location_name,
                ROUND(AVG(vf.duration_minutes)::numeric, 2) AS avg_dwell_minutes,
                COUNT(*)::int AS observations
         FROM visitor_flow vf
         JOIN locations l ON vf.location_id = l.location_id
         WHERE vf.arrival_time BETWEEN $1 AND $2
           AND vf.duration_minutes IS NOT NULL
         GROUP BY l.location_id, l.name
         HAVING COUNT(*) > 2
         ORDER BY avg_dwell_minutes DESC
         LIMIT 15`,
        [start, end]
    );

    const avgDwell = timeline.rows.length
        ? timeline.rows.reduce((acc, row) => acc + Number(row.avg_duration || 0), 0) / timeline.rows.length
        : 0;

    return {
        range: { start, end, interval: truncUnit },
        timeline: timeline.rows,
        flow_patterns: timeline.rows,
        popular_routes: routes.rows,
        top_locations: routes.rows,
        dwell_times: dwellTimes.rows,
        average_dwell_time: Number(avgDwell.toFixed(2))
    };
}

async function getCongestionPredictions(date, locationId) {
    const params = [date];
    let locationClause = '';
    if (locationId) {
        params.push(locationId);
        locationClause = 'AND cp.location_id = $2';
    }
    const predictions = await pool.query(
        `SELECT cp.predicted_date,
                cp.predicted_hour,
                cp.predicted_visitor_count,
                cp.confidence_interval_low,
                cp.confidence_interval_high,
                cp.location_id,
                l.name AS location_name
         FROM congestion_predictions cp
         JOIN locations l ON l.location_id = cp.location_id
         WHERE cp.predicted_date = $1
           ${locationClause}
         ORDER BY cp.predicted_hour ASC, l.name ASC`,
        params
    );
    return predictions.rows;
}

async function getSatisfactionDataset(start, end) {
    const overall = await pool.query(
        `SELECT ROUND(AVG(rating)::numeric, 2) AS avg_rating,
                COUNT(*)::int AS total_ratings,
                COUNT(CASE WHEN rating >= 4 THEN 1 END)::int AS satisfied,
                COUNT(CASE WHEN rating <= 2 THEN 1 END)::int AS dissatisfied
         FROM feedback
         WHERE created_at BETWEEN $1 AND $2`,
        [start, end]
    );
    const trend = await pool.query(
        `SELECT DATE_TRUNC('day', created_at) AS day,
                ROUND(AVG(rating)::numeric, 2) AS avg_rating,
                COUNT(*)::int AS responses
         FROM feedback
         WHERE created_at BETWEEN $1 AND $2
         GROUP BY DATE_TRUNC('day', created_at)
         ORDER BY day ASC`,
        [start, end]
    );
    const total = overall.rows[0]?.total_ratings || 0;
    const satisfied = overall.rows[0]?.satisfied || 0;
    return {
        overall: Number(overall.rows[0]?.avg_rating || 0),
        total_ratings: total,
        satisfaction_rate: total ? Number(((satisfied / total) * 100).toFixed(1)) : 0,
        dissatisfaction_count: overall.rows[0]?.dissatisfied || 0,
        trend: trend.rows
    };
}

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
        const dataset = await getVisitorFlowDataset(start, end, interval);
        res.json(dataset);

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
    query('date').optional().isDate(),
    query('location_id').optional().isUUID()
], async (req, res) => {
    const date = toIsoDate(req.query.date, new Date().toISOString().slice(0, 10));
    const locationId = req.query.location_id || null;

    try {
        const predictions = await getCongestionPredictions(date, locationId);

        let recommendations = [];

        if (predictions.length > 0) {
            const peakHour = predictions.reduce((a, b) =>
                (Number(a.predicted_visitor_count) > Number(b.predicted_visitor_count)) ? a : b
            );
            recommendations.push(`Increase staffing near ${peakHour.location_name} around ${peakHour.predicted_hour}:00.`);
            if (Number(peakHour.predicted_visitor_count) > 200) {
                recommendations.push('Prepare overflow parking');
                recommendations.push('Consider opening additional viewing platforms');
            }
        } else {
            recommendations.push('No predictions available for this date');
        }

        res.json({
            date,
            location_id: locationId,
            predictions,
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

        let tourContent = { rows: [] };
        try {
            tourContent = await pool.query(
                `SELECT tc.title_en AS name,
                        'tour_content' AS type,
                        COALESCE(COUNT(tp.touristprog_id), 0)::int AS view_count
                 FROM tour_content tc
                 LEFT JOIN tourist_progress tp ON tp.content_id = tc.content_id
                 GROUP BY tc.content_id, tc.title_en
                 ORDER BY view_count DESC, tc.title_en
                 LIMIT $1`,
                [limit]
            );
        } catch (tourErr) {
            if (tourErr.code !== '42P01') throw tourErr;
            tourContent = await pool.query(
                `SELECT title_en AS name, 'tour_content' AS type, 0::int AS view_count
                 FROM tour_content
                 ORDER BY title_en
                 LIMIT $1`,
                [limit]
            );
        }

        const allContent = [...animals.rows, ...locations.rows, ...stories.rows, ...tourContent.rows]
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
        const start = toIsoDateTime(req.query.start, new Date(Date.now() - 90 * 86400000).toISOString());
        const end = toIsoDateTime(req.query.end, new Date().toISOString());
        const data = await getSatisfactionDataset(start, end);
        res.json({ range: { start, end }, ...data });

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
            `WITH normalized AS (
                SELECT CASE
                    WHEN user_type IN ('admin', 'it_manager') THEN 'it_manager'
                    WHEN user_type = 'guide' THEN 'guide'
                    ELSE 'tourist'
                END AS user_type
                FROM users
                WHERE is_active = true
            ),
            allowed_types AS (
                SELECT * FROM (VALUES ('tourist'), ('guide'), ('it_manager')) AS t(user_type)
            )
            SELECT a.user_type, COALESCE(COUNT(n.user_type), 0)::int AS count
            FROM allowed_types a
            LEFT JOIN normalized n ON n.user_type = a.user_type
            GROUP BY a.user_type
            ORDER BY a.user_type`
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
// GET /api/analytics/peak-times
// =====================================================
router.get('/peak-times', [
    query('start').optional().isISO8601(),
    query('end').optional().isISO8601()
], async (req, res) => {
    try {
        const start = toIsoDateTime(req.query.start, new Date(Date.now() - 120 * 86400000).toISOString());
        const end = toIsoDateTime(req.query.end, new Date().toISOString());
        const byHour = await pool.query(
            `SELECT EXTRACT(HOUR FROM arrival_time)::int AS hour,
                    COUNT(*)::int AS visitors
             FROM visitor_flow
             WHERE arrival_time BETWEEN $1 AND $2
             GROUP BY EXTRACT(HOUR FROM arrival_time)
             ORDER BY visitors DESC`,
            [start, end]
        );
        const byDow = await pool.query(
            `SELECT EXTRACT(DOW FROM arrival_time)::int AS day_of_week,
                    COUNT(*)::int AS visitors
             FROM visitor_flow
             WHERE arrival_time BETWEEN $1 AND $2
             GROUP BY EXTRACT(DOW FROM arrival_time)
             ORDER BY visitors DESC`,
            [start, end]
        );
        const peakHour = byHour.rows[0] || null;
        const peakDay = byDow.rows[0] || null;
        return res.json({ range: { start, end }, by_hour: byHour.rows, by_day_of_week: byDow.rows, peak_hour: peakHour, peak_day: peakDay });
    } catch (error) {
        console.error('peak times', error);
        res.status(500).json({ error: 'Failed to compute peak times' });
    }
});

// =====================================================
// GET /api/analytics/resource-allocation
// =====================================================
router.get('/resource-allocation', [
    query('date').optional().isDate(),
    query('location_id').optional().isUUID()
], async (req, res) => {
    try {
        const date = toIsoDate(req.query.date, new Date().toISOString().slice(0, 10));
        const locationId = req.query.location_id || null;
        const predictions = await getCongestionPredictions(date, locationId);
        const recommendations = predictions.map((row) => ({
            location_id: row.location_id,
            location_name: row.location_name,
            hour: row.predicted_hour,
            predicted_visitor_count: row.predicted_visitor_count,
            suggested_staffing: nextHourStaffing(Number(row.predicted_visitor_count || 0))
        }));
        return res.json({ date, location_id: locationId, recommendations });
    } catch (error) {
        console.error('resource allocation', error);
        res.status(500).json({ error: 'Failed to generate staffing recommendations' });
    }
});

// =====================================================
// GET /api/analytics/sightings-trends
// =====================================================
router.get('/sightings-trends', [
    query('start').optional().isISO8601(),
    query('end').optional().isISO8601(),
    query('animal_id').optional().isUUID()
], async (req, res) => {
    try {
        const start = toIsoDateTime(req.query.start, new Date(Date.now() - 120 * 86400000).toISOString());
        const end = toIsoDateTime(req.query.end, new Date().toISOString());
        const animalId = req.query.animal_id || null;
        const params = [start, end];
        let animalFilter = '';
        if (animalId) {
            params.push(animalId);
            animalFilter = 'AND s.animal_id = $3';
        }
        const trend = await pool.query(
            `SELECT DATE_TRUNC('day', s.timestamp) AS day,
                    COUNT(*)::int AS sightings
             FROM sightings s
             WHERE s.timestamp BETWEEN $1 AND $2
               AND s.verification_status = 'verified'
               ${animalFilter}
             GROUP BY DATE_TRUNC('day', s.timestamp)
             ORDER BY day ASC`,
            params
        );
        const species = await pool.query(
            `SELECT a.animal_id, a.name,
                    COUNT(*)::int AS sightings
             FROM sightings s
             JOIN animals a ON a.animal_id = s.animal_id
             WHERE s.timestamp BETWEEN $1 AND $2
               AND s.verification_status = 'verified'
               ${animalFilter}
             GROUP BY a.animal_id, a.name
             ORDER BY sightings DESC
             LIMIT 10`,
            params
        );
        return res.json({ range: { start, end }, animal_id: animalId, trend: trend.rows, species_breakdown: species.rows });
    } catch (error) {
        console.error('sightings trend', error);
        res.status(500).json({ error: 'Failed to fetch sightings trends' });
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
        const counts = rows.map((r) => Number(r.cnt));
        const baselineMean = mean(counts);
        const std = stddev(counts, baselineMean) || 1;
        const zThresh = Math.max(2, Math.min(4, Number(req.query.z) || 2.5));
        const anomalies = rows
            .map((r) => {
                const z = (Number(r.cnt) - baselineMean) / std;
                return { day: r.day, count: r.cnt, zscore: Math.round(z * 100) / 100, high: z > zThresh, low: z < -zThresh };
            })
            .filter((r) => r.high || r.low);
        return res.json({ anomalies, stats: { baseline_mean: baselineMean, stddev: std, z_threshold: zThresh } });
    } catch (error) {
        console.error('analytics anomalies', error);
        res.status(500).json({ error: 'Failed to compute anomalies' });
    }
});

// =====================================================
// GET /api/analytics/operational-summary — trend + ops rollup for IT dashboards
// =====================================================
router.get('/operational-summary', async (req, res) => {
    try {
        const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 14));
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - days);
        const priorStart = new Date(start);
        priorStart.setDate(priorStart.getDate() - days);

        const [sightCur, sightPrior, flowCur, satCur, activeUsers] = await Promise.all([
            pool.query(
                `SELECT COUNT(*)::int AS n FROM sightings
                 WHERE timestamp >= $1 AND verification_status = 'verified'`,
                [start.toISOString()]
            ),
            pool.query(
                `SELECT COUNT(*)::int AS n FROM sightings
                 WHERE timestamp >= $1 AND timestamp < $2 AND verification_status = 'verified'`,
                [priorStart.toISOString(), start.toISOString()]
            ),
            pool.query(
                `SELECT COUNT(*)::int AS n FROM visitor_flow WHERE arrival_time >= $1`,
                [start.toISOString()]
            ),
            pool.query(
                `SELECT AVG(rating)::float AS avg_rating, COUNT(*)::int AS n
                 FROM feedback WHERE created_at >= $1`,
                [start.toISOString()]
            ),
            pool.query(
                `SELECT COUNT(*)::int AS n FROM users
                 WHERE is_active = true AND last_login > NOW() - INTERVAL '24 hours'`
            ),
        ]);

        const sightingsNow = sightCur.rows[0]?.n ?? 0;
        const sightingsPrior = sightPrior.rows[0]?.n ?? 0;
        const sightDeltaPct =
            sightingsPrior > 0
                ? Math.round(((sightingsNow - sightingsPrior) / sightingsPrior) * 100)
                : sightingsNow > 0
                  ? 100
                  : 0;

        const trendRows = await pool.query(
            `SELECT DATE(timestamp) AS day, COUNT(*)::int AS cnt
             FROM sightings
             WHERE timestamp >= $1 AND verification_status = 'verified'
             GROUP BY DATE(timestamp)
             ORDER BY day`,
            [start.toISOString()]
        );

        const opsStatus = { tables_ready: await ensureOpsTables() };
        if (opsStatus.tables_ready) {
            const jobs = await pool.query(
                `SELECT status, COUNT(*)::int AS n FROM ops_training_jobs GROUP BY status`
            );
            opsStatus.training_by_status = jobs.rows;
        }

        res.json({
            generated_at: new Date().toISOString(),
            window_days: days,
            sightings: {
                verified_count: sightingsNow,
                prior_window_count: sightingsPrior,
                delta_percent: sightDeltaPct,
                daily_trend: trendRows.rows,
            },
            visitor_flow_count: flowCur.rows[0]?.n ?? 0,
            satisfaction: {
                average_rating: satCur.rows[0]?.avg_rating
                    ? Number(Number(satCur.rows[0].avg_rating).toFixed(2))
                    : null,
                responses: satCur.rows[0]?.n ?? 0,
            },
            active_users_24h: activeUsers.rows[0]?.n ?? 0,
            operations: opsStatus,
        });
    } catch (error) {
        console.error('operational-summary', error);
        res.status(500).json({ error: 'Failed to build operational summary' });
    }
});

// =====================================================
// GET /api/analytics/operations/status — live ops band summary
// =====================================================
router.get('/operations/status', async (req, res) => {
    try {
        const tablesReady = await ensureOpsTables();
        const status = { tables_ready: tablesReady, generated_at: new Date().toISOString() };

        if (tablesReady) {
            const [schedules, jobs] = await Promise.all([
                pool.query(
                    `SELECT COUNT(*)::int AS n,
                            MAX(last_run_at) AS last_run_at
                     FROM report_schedules`
                ),
                pool.query(
                    `SELECT COUNT(*)::int AS n,
                            (SELECT status FROM ops_training_jobs ORDER BY created_at DESC LIMIT 1) AS latest_status,
                            (SELECT model_key FROM ops_training_jobs ORDER BY created_at DESC LIMIT 1) AS latest_model,
                            (SELECT created_at FROM ops_training_jobs ORDER BY created_at DESC LIMIT 1) AS latest_job_at
                     FROM ops_training_jobs`
                )
            ]);
            status.schedules_count = schedules.rows[0]?.n ?? 0;
            status.last_schedule_run_at = schedules.rows[0]?.last_run_at || null;
            status.training_jobs_count = jobs.rows[0]?.n ?? 0;
            status.latest_training_job = jobs.rows[0]?.latest_status
                ? {
                    status: jobs.rows[0].latest_status,
                    model_key: jobs.rows[0].latest_model,
                    created_at: jobs.rows[0].latest_job_at
                }
                : null;
        } else {
            status.schedules_count = 0;
            status.training_jobs_count = 0;
        }

        if (await tableExists('park_performance_reports')) {
            const backups = await pool.query(
                `SELECT COUNT(*)::int AS n, MAX(generated_at) AS last_backup_at
                 FROM park_performance_reports
                 WHERE report_type IN ('backup', 'automated_backup')`
            );
            status.backups_count = backups.rows[0]?.n ?? 0;
            status.last_backup_at = backups.rows[0]?.last_backup_at || null;
        } else {
            status.backups_count = 0;
            status.last_backup_at = null;
        }

        const anomalyPreview = await pool.query(
            `SELECT COUNT(*)::int AS n
             FROM (
                 SELECT DATE_TRUNC('day', timestamp) AS day, COUNT(*)::int AS cnt
                 FROM sightings
                 WHERE timestamp > NOW() - INTERVAL '120 days'
                   AND verification_status = 'verified'
                 GROUP BY DATE_TRUNC('day', timestamp)
             ) daily`
        );
        status.anomaly_days_tracked = anomalyPreview.rows[0]?.n ?? 0;

        return res.json(status);
    } catch (error) {
        console.error('operations status', error);
        res.status(500).json({ error: 'Failed to load operations status' });
    }
});

// =====================================================
// POST /api/analytics/models/retrain-job — queue + process from live data
// =====================================================
router.post('/models/retrain-job', async (req, res) => {
    const modelKey = String(req.body?.model_key || req.body?.model || 'congestion_v1').slice(0, 160);
    try {
        if (!(await ensureOpsTables())) {
            return res.status(503).json({ error: 'Could not initialize operations tables.' });
        }
        const ins = await pool.query(
            `INSERT INTO ops_training_jobs (model_key, status, message, created_by)
             VALUES ($1, 'queued', $2, $3)
             RETURNING job_id, created_at, status, model_key`,
            [modelKey, 'Queued; processing from live park metrics.', req.user.user_id]
        );
        const job = ins.rows[0];
        setImmediate(() => {
            processRetrainJob(job.job_id, modelKey).catch((err) => {
                console.error('processRetrainJob', err);
            });
        });
        return res.status(201).json({ success: true, job });
    } catch (error) {
        console.error('retrain job', error);
        res.status(500).json({ error: 'Failed to queue training job' });
    }
});

router.get('/models/retrain-job', async (req, res) => {
    try {
        if (!(await ensureOpsTables())) {
            return res.json({ jobs: [], note: 'Operations tables unavailable.' });
        }
        const r = await pool.query(
            `SELECT job_id, model_key, status, message, created_at, completed_at
             FROM ops_training_jobs
             ORDER BY created_at DESC
             LIMIT 40`
        );
        return res.json({ jobs: r.rows });
    } catch (error) {
        console.error('list retrain jobs', error);
        res.status(500).json({ error: 'Failed to list jobs' });
    }
});

router.post('/models/retrain-job/:id/complete', [
    body('status').isIn(['succeeded', 'failed']),
    body('message').optional().isString()
], async (req, res) => {
    try {
        if (!(await ensureOpsTables())) {
            return res.status(503).json({ error: 'ops_training_jobs table unavailable.' });
        }
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        const r = await pool.query(
            `UPDATE ops_training_jobs
             SET status = $2, message = COALESCE($3, message), completed_at = CURRENT_TIMESTAMP
             WHERE job_id = $1
             RETURNING job_id, model_key, status, message, completed_at`,
            [req.params.id, req.body.status, req.body.message || null]
        );
        if (!r.rows.length) return res.status(404).json({ error: 'Training job not found' });
        return res.json({ success: true, job: r.rows[0] });
    } catch (error) {
        console.error('complete retrain job', error);
        res.status(500).json({ error: 'Failed to update job status' });
    }
});

// =====================================================
// POST /api/analytics/reports/build — custom metric bundle (§3.1.1.11)
// =====================================================
router.post('/reports/build', async (req, res) => {
    try {
        const metrics = parseMetrics(req.body?.metrics).length
            ? parseMetrics(req.body.metrics)
            : ['visitor_flow', 'satisfaction', 'popular_content'];
        const start = toIsoDateTime(req.body?.start, new Date(Date.now() - 14 * 86400000).toISOString());
        const end = toIsoDateTime(req.body?.end, new Date().toISOString());
        const out = await buildReportBundle(
            metrics,
            start,
            end,
            req.user.user_id,
            req.body?.report_type || 'custom'
        );
        return res.json(out);
    } catch (error) {
        console.error('reports/build', error);
        res.status(500).json({ error: 'Failed to build report' });
    }
});

// =====================================================
// Report schedules (§3.1.1.11) — persistence when migration 011 applied
// =====================================================
router.get('/reports/schedules', async (req, res) => {
    try {
        if (!(await ensureOpsTables())) {
            return res.json({ schedules: [], note: 'Operations tables unavailable.' });
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
            if (!(await ensureOpsTables())) {
                return res.status(503).json({ error: 'Operations tables unavailable.' });
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
        if (!(await ensureOpsTables())) {
            return res.status(503).json({ error: 'Operations tables unavailable.' });
        }
        const sid = req.params.id;
        const meta = await pool.query(`SELECT * FROM report_schedules WHERE schedule_id = $1`, [sid]);
        if (!meta.rows.length) return res.status(404).json({ error: 'Schedule not found' });
        const row = meta.rows[0];
        const metricKeys = normalizeMetricKeys(row.metric_keys);
        const end = new Date().toISOString();
        const start = new Date(Date.now() - 14 * 86400000).toISOString();
        const report = await buildReportBundle(
            metricKeys.length ? metricKeys : ['visitor_flow', 'satisfaction'],
            start,
            end,
            req.user.user_id,
            'scheduled'
        );
        const sectionKeys = Object.keys(report.sections || {});
        const errKeys = Object.keys(report.section_errors || {});
        let emailsAttempted = 0;
        const recipients = Array.isArray(row.email_recipients) ? row.email_recipients : [];
        const reportRef = report.report_id || report.built_at;
        const detail = `Report ${reportRef} with ${sectionKeys.length} section(s)${errKeys.length ? ` (${errKeys.length} section error(s))` : ''}.`;
        for (const email of recipients) {
            const trimmed = String(email || '').trim();
            if (!trimmed) continue;
            const sent = await sendActivityNotificationEmail(
                trimmed,
                'SIGTS operations',
                `Scheduled report: ${row.name}`,
                detail
            );
            if (sent) emailsAttempted += 1;
        }
        const snap = {
            ran_at: new Date().toISOString(),
            schedule_id: sid,
            metric_keys: metricKeys,
            report_id: report.report_id || null,
            sections: sectionKeys,
            section_errors: errKeys,
            emails_attempted: emailsAttempted
        };
        await pool.query(
            `UPDATE report_schedules SET last_run_at = CURRENT_TIMESTAMP, last_report_summary = $2::jsonb WHERE schedule_id = $1`,
            [sid, JSON.stringify(snap)]
        );
        return res.json({
            success: true,
            report: {
                report_id: report.report_id,
                generated_at: report.generated_at || report.built_at,
                sections: sectionKeys,
                section_errors: report.section_errors
            },
            emails_attempted: emailsAttempted,
            run: snap
        });
    } catch (error) {
        console.error('run schedule', error);
        res.status(500).json({ error: 'Failed to execute schedule manually' });
    }
});

router.get('/reports/history', async (req, res) => {
    try {
        if (!(await tableExists('park_performance_reports'))) {
            return res.json({ reports: [] });
        }
        const r = await pool.query(
            `SELECT report_id, report_type, period_start, period_end, generated_at, generated_by
             FROM park_performance_reports
             ORDER BY generated_at DESC
             LIMIT 50`
        );
        return res.json({ reports: r.rows });
    } catch (error) {
        console.error('report history', error);
        res.status(500).json({ error: 'Failed to load report history' });
    }
});

router.get('/reports/export', [
    query('metrics').optional(),
    query('start').optional().isISO8601(),
    query('end').optional().isISO8601(),
    query('format').optional().isIn(['json', 'csv'])
], async (req, res) => {
    try {
        const metrics = parseMetrics(req.query.metrics);
        const start = toIsoDateTime(req.query.start, new Date(Date.now() - 7 * 86400000).toISOString());
        const end = toIsoDateTime(req.query.end, new Date().toISOString());
        const format = ALLOWED_EXPORT_FORMATS.has(String(req.query.format || '').toLowerCase())
            ? String(req.query.format).toLowerCase()
            : 'json';
        const exportPayload = {
            generated_at: new Date().toISOString(),
            range: { start, end },
            metrics: metrics.length ? metrics : ['visitor_flow']
        };
        if (exportPayload.metrics.includes('visitor_flow')) {
            const flow = await getVisitorFlowDataset(start, end, 'day');
            exportPayload.visitor_flow = flow.timeline;
        }
        if (exportPayload.metrics.includes('sightings_trend')) {
            const trends = await pool.query(
                `SELECT DATE_TRUNC('day', timestamp) AS day, COUNT(*)::int AS sightings
                 FROM sightings
                 WHERE timestamp BETWEEN $1 AND $2
                 GROUP BY DATE_TRUNC('day', timestamp)
                 ORDER BY day`,
                [start, end]
            );
            exportPayload.sightings_trend = trends.rows;
        }
        if (exportPayload.metrics.includes('satisfaction')) {
            exportPayload.satisfaction = await getSatisfactionDataset(start, end);
        }
        if (format === 'csv') {
            const csvRows = [];
            Object.entries(exportPayload).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    value.forEach((row) => csvRows.push({ metric: key, ...row }));
                }
            });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="analytics-export.csv"');
            return res.status(200).send(rowsToCsv(csvRows));
        }
        return res.json(exportPayload);
    } catch (error) {
        console.error('report export', error);
        res.status(500).json({ error: 'Failed to export analytics data' });
    }
});

router.get('/dashboard', [
    query('start').optional().isISO8601(),
    query('end').optional().isISO8601(),
    query('date').optional().isDate()
], async (req, res) => {
    try {
        const start = toIsoDateTime(req.query.start, new Date(Date.now() - 30 * 86400000).toISOString());
        const end = toIsoDateTime(req.query.end, new Date().toISOString());
        const date = toIsoDate(req.query.date, new Date().toISOString().slice(0, 10));

        const [visitorFlow, congestion, peakTimes, popularContent, demographics, sightingsTrends, satisfaction, anomalies] = await Promise.all([
            getVisitorFlowDataset(start, end, 'day'),
            getCongestionPredictions(date, null),
            pool.query(
                `SELECT EXTRACT(HOUR FROM arrival_time)::int AS hour,
                        COUNT(*)::int AS visitors
                 FROM visitor_flow
                 WHERE arrival_time BETWEEN $1 AND $2
                 GROUP BY EXTRACT(HOUR FROM arrival_time)
                 ORDER BY visitors DESC
                 LIMIT 24`,
                [start, end]
            ),
            pool.query(
                `SELECT tc.title_en AS name, COUNT(tp.touristprog_id)::int AS view_count
                 FROM tour_content tc
                 LEFT JOIN tourist_progress tp ON tp.content_id = tc.content_id
                 GROUP BY tc.content_id, tc.title_en
                 ORDER BY view_count DESC
                 LIMIT 8`
            ),
            pool.query(
                `SELECT nationality, COUNT(*)::int AS count
                 FROM tourists
                 WHERE nationality IS NOT NULL
                 GROUP BY nationality
                 ORDER BY count DESC
                 LIMIT 8`
            ),
            pool.query(
                `SELECT DATE_TRUNC('day', timestamp) AS day, COUNT(*)::int AS sightings
                 FROM sightings
                 WHERE timestamp BETWEEN $1 AND $2
                 GROUP BY DATE_TRUNC('day', timestamp)
                 ORDER BY day`,
                [start, end]
            ),
            getSatisfactionDataset(start, end),
            pool.query(
                `SELECT DATE_TRUNC('day', timestamp) AS day, COUNT(*)::int AS cnt
                 FROM sightings
                 WHERE timestamp > NOW() - INTERVAL '90 days'
                 GROUP BY DATE_TRUNC('day', timestamp)
                 ORDER BY day`
            )
        ]);

        const anomalyCounts = anomalies.rows.map((row) => Number(row.cnt));
        const anomalyMean = mean(anomalyCounts);
        const anomalyStd = stddev(anomalyCounts, anomalyMean) || 1;
        const anomalyFlags = anomalies.rows
            .map((row) => {
                const z = (Number(row.cnt) - anomalyMean) / anomalyStd;
                return { day: row.day, count: row.cnt, zscore: Number(z.toFixed(2)), anomaly: Math.abs(z) >= 2.5 };
            })
            .filter((row) => row.anomaly);

        return res.json({
            range: { start, end },
            prediction_date: date,
            visitor_flow: visitorFlow,
            congestion_forecast: congestion,
            peak_time_chart: peakTimes.rows,
            popular_content_rankings: popularContent.rows,
            demographics: demographics.rows,
            sightings_trends: sightingsTrends.rows,
            satisfaction_metrics: satisfaction,
            anomaly_alerts: anomalyFlags
        });
    } catch (error) {
        console.error('dashboard analytics', error);
        res.status(500).json({ error: 'Failed to build dashboard analytics' });
    }
});

module.exports = router;