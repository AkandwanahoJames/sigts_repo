// backend/src/routes/geofence.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateJWT } = require('../middleware/auth');
const { readCoordinates, isInsidePark } = require('../middleware/parkGeofence');
const { requireConsent } = require('../middleware/consent');
const { checkPoiProximityAndNotify } = require('../services/proximityAlerts');

async function evaluateMandatorySafeZones(userId, lat, lng, insidePark) {
    const alerts = [];
    if (!insidePark || !userId) {
        return { alerts, violationRecorded: false };
    }
    try {
        const mandatory = await pool.query(
            `SELECT EXISTS (SELECT 1 FROM park_safe_zones WHERE is_mandatory = true) AS has_mandatory`
        );
        if (!mandatory.rows[0]?.has_mandatory) {
            return { alerts, violationRecorded: false };
        }

        const insideAny = await pool.query(
            `SELECT EXISTS (
                SELECT 1 FROM park_safe_zones sz
                WHERE sz.is_mandatory = true
                  AND ST_Contains(sz.boundary, ST_SetSRID(ST_MakePoint($1::float8, $2::float8), 4326))
            ) AS inside_any`,
            [lng, lat]
        );
        if (insideAny.rows[0]?.inside_any) {
            return { alerts, violationRecorded: false };
        }

        const msg =
            'Park operations: your position is outside the active visitor-safety corridors for this period. ' +
            'Return toward an approved route, gate, or camp, or contact your guide / UWA ranger on radio.';

        alerts.push({
            code: 'MANDATORY_SAFE_ZONE',
            severity: 'high',
            message: msg
        });

        const recent = await pool.query(
            `SELECT 1 FROM safe_zone_violations
             WHERE user_id = $1
               AND acknowledged = false
               AND created_at > NOW() - INTERVAL '15 minutes'
             LIMIT 1`,
            [userId]
        );
        if (recent.rows.length) {
            return { alerts, violationRecorded: false };
        }

        await pool.query(
            `INSERT INTO safe_zone_violations (user_id, latitude, longitude, violation_kind, detail)
             VALUES ($1, $2, $3, 'outside_mandatory_union', $4)`,
            [userId, lat, lng, msg]
        );
        return { alerts, violationRecorded: true };
    } catch (e) {
        if (e.code === '42P01') {
            return { alerts, violationRecorded: false };
        }
        throw e;
    }
}

// =====================================================
// POST /api/geofence/validate
// Validate if user is inside park boundaries
// =====================================================
router.post('/validate', authenticateJWT, async (req, res) => {
    const coordinates = readCoordinates(req);

    if (!coordinates) {
        return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    try {
        const insidePark = await isInsidePark(coordinates.lat, coordinates.lng);

        res.json({ isInsidePark: insidePark });

    } catch (error) {
        console.error('Geofence validation error:', error);
        res.status(500).json({ error: 'Failed to validate location' });
    }
});

// =====================================================
// POST /api/geofence/location-update
// Persist user location + emit entry/exit events
// =====================================================
router.post('/location-update', authenticateJWT, requireConsent('location_tracking'), async (req, res) => {
    const coordinates = readCoordinates(req);
    const { accuracy, speed_kmh, heading_degrees, timestamp } = req.body;

    if (!coordinates) {
        return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    try {
        const insidePark = await isInsidePark(coordinates.lat, coordinates.lng);
        const userId = req.user.user_id;

        await pool.query(
            `INSERT INTO location_history (
                user_id, latitude, longitude, accuracy_meters, speed_kmh, heading_degrees, captured_at, inside_park
            ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, CURRENT_TIMESTAMP), $8)`,
            [
                userId,
                coordinates.lat,
                coordinates.lng,
                Number.isFinite(Number(accuracy)) ? Number(accuracy) : null,
                Number.isFinite(Number(speed_kmh)) ? Number(speed_kmh) : null,
                Number.isFinite(Number(heading_degrees)) ? Number(heading_degrees) : null,
                timestamp || null,
                insidePark
            ]
        );

        await pool.query(
            `UPDATE users
             SET last_lat = $1, last_lng = $2, last_location_time = CURRENT_TIMESTAMP
             WHERE user_id = $3`,
            [coordinates.lat, coordinates.lng, userId]
        );

        const previous = await pool.query(
            `SELECT inside_park
             FROM location_history
             WHERE user_id = $1
             ORDER BY captured_at DESC
             OFFSET 1
             LIMIT 1`,
            [userId]
        );

        const previousInside = previous.rows[0]?.inside_park;
        if (previousInside !== undefined && previousInside !== insidePark) {
            await pool.query(
                `INSERT INTO geofence_events (user_id, event_type, latitude, longitude)
                 VALUES ($1, $2, $3, $4)`,
                [userId, insidePark ? 'entry' : 'exit', coordinates.lat, coordinates.lng]
            );
        }

        let operationalAlerts = [];
        let violationRecorded = false;
        let proximityAlerts = [];
        try {
            const sz = await evaluateMandatorySafeZones(userId, coordinates.lat, coordinates.lng, insidePark);
            operationalAlerts = sz.alerts || [];
            violationRecorded = Boolean(sz.violationRecorded);
        } catch (szErr) {
            console.warn('Safe zone evaluation skipped:', szErr.message);
        }

        if (insidePark) {
            try {
                proximityAlerts = await checkPoiProximityAndNotify(userId, coordinates.lat, coordinates.lng);
            } catch (proxErr) {
                console.warn('Proximity notification skipped:', proxErr.message);
            }
        }

        return res.json({
            success: true,
            insidePark,
            event: previousInside !== undefined && previousInside !== insidePark ? (insidePark ? 'entry' : 'exit') : null,
            operational_alerts: operationalAlerts,
            safe_zone_violation_logged: violationRecorded,
            proximity_alerts: proximityAlerts
        });
    } catch (error) {
        console.error('Location update error:', error);
        return res.status(500).json({ error: 'Failed to process location update' });
    }
});

// =====================================================
// GET /api/geofence/events
// Recent entry/exit events for authenticated user
// =====================================================
router.get('/events', authenticateJWT, async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 200);
    try {
        const result = await pool.query(
            `SELECT geofence_event_id, event_type, latitude, longitude, event_time
             FROM geofence_events
             WHERE user_id = $1
             ORDER BY event_time DESC
             LIMIT $2`,
            [req.user.user_id, limit]
        );
        return res.json({ events: result.rows });
    } catch (error) {
        console.error('Get geofence events error:', error);
        return res.status(500).json({ error: 'Failed to fetch geofence events' });
    }
});

// =====================================================
// GET /api/geofence/boundary
// Get park boundary polygon
// =====================================================
router.get('/boundary', authenticateJWT, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ST_AsGeoJSON(geofence_boundary) as boundary
             FROM parks 
             WHERE park_id = (SELECT park_id FROM parks LIMIT 1)`
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Park boundary not found' });
        }

        const boundary = JSON.parse(result.rows[0].boundary);

        res.json(boundary);

    } catch (error) {
        console.error('Get boundary error:', error);
        res.status(500).json({ error: 'Failed to get park boundary' });
    }
});

module.exports = router;