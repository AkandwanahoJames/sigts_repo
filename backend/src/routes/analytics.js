// backend/src/routes/analytics.js
const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
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

module.exports = router;