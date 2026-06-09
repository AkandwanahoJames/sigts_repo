/**
 * Dedicated distance / bearing utilities (§3.1.1.2 + map module).
 */
const express = require('express');
const { query, validationResult } = require('express-validator');
const router = express.Router();

function toRad(d) {
    return (Number(d) * Math.PI) / 180;
}

function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function bearingDegrees(lat1, lng1, lat2, lng2) {
    const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
    const x =
        Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
        Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
    let brng = (Math.atan2(y, x) * 180) / Math.PI;
    brng = (brng + 360) % 360;
    const cardinal = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(brng / 45) % 8];
    return { degrees: Math.round(brng * 100) / 100, cardinal };
}

router.get(
    '/distance',
    [
        query('from_lat').isFloat({ min: -90, max: 90 }),
        query('from_lng').isFloat({ min: -180, max: 180 }),
        query('to_lat').isFloat({ min: -90, max: 90 }),
        query('to_lng').isFloat({ min: -180, max: 180 })
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        const { from_lat: a1, from_lng: o1, to_lat: a2, to_lng: o2 } = req.query;
        const meters = haversineMeters(+a1, +o1, +a2, +o2);
        return res.json({
            meters,
            kilometres: Math.round((meters / 1000) * 1000) / 1000
        });
    }
);

router.get(
    '/bearing',
    [
        query('from_lat').isFloat({ min: -90, max: 90 }),
        query('from_lng').isFloat({ min: -180, max: 180 }),
        query('to_lat').isFloat({ min: -90, max: 90 }),
        query('to_lng').isFloat({ min: -180, max: 180 })
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        const { from_lat: a1, from_lng: o1, to_lat: a2, to_lng: o2 } = req.query;
        const b = bearingDegrees(+a1, +o1, +a2, +o2);
        return res.json(b);
    }
);

router.get(
    '/walking-route',
    [
        query('from_lat').isFloat({ min: -90, max: 90 }),
        query('from_lng').isFloat({ min: -180, max: 180 }),
        query('to_lat').isFloat({ min: -90, max: 90 }),
        query('to_lng').isFloat({ min: -180, max: 180 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        const { from_lat: a1, from_lng: o1, to_lat: a2, to_lng: o2 } = req.query;
        const url =
            `https://router.project-osrm.org/route/v1/foot/${o1},${a1};${o2},${a2}` +
            '?overview=full&geometries=geojson&steps=true';
        try {
            const osrm = await fetch(url, { signal: AbortSignal.timeout(10000) });
            if (!osrm.ok) throw new Error(`OSRM ${osrm.status}`);
            const data = await osrm.json();
            const route = data.routes?.[0];
            if (!route) return res.status(404).json({ error: 'No walking route found' });
            const steps = (route.legs?.[0]?.steps || []).map((s, i) => ({
                index: i + 1,
                instruction: s.maneuver?.instruction || s.name || 'Continue on trail',
                distance_m: Math.round(s.distance || 0),
                duration_s: Math.round(s.duration || 0)
            }));
            return res.json({
                distance_m: Math.round(route.distance || 0),
                duration_s: Math.round(route.duration || 0),
                geometry: route.geometry,
                steps
            });
        } catch (err) {
            console.warn('OSRM route failed:', err.message);
            return res.status(502).json({ error: 'Walking route service unavailable', fallback: true });
        }
    }
);

module.exports = router;
