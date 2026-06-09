/**
 * POI proximity → in-app notifications (§4.4.3 location-based alerts).
 */
const { pool } = require('../config/database');
const { notifyProximityAlert } = require('./inAppNotifications');

const cooldownMs = 10 * 60 * 1000;
const cooldown = new Map();

function cooldownKey(userId, locationId) {
    return `${userId}:${locationId}`;
}

async function checkPoiProximityAndNotify(userId, lat, lng) {
    if (!userId || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];

    let rows = [];
    try {
        const result = await pool.query(
            `SELECT location_id, name,
                    COALESCE(trigger_radius, 120)::float AS trigger_radius,
                    ST_Distance(
                        coordinates::geography,
                        ST_SetSRID(ST_MakePoint($2::float8, $1::float8), 4326)::geography
                    ) AS dist_m
             FROM locations
             WHERE coordinates IS NOT NULL
               AND ST_DWithin(
                   coordinates::geography,
                   ST_SetSRID(ST_MakePoint($2::float8, $1::float8), 4326)::geography,
                   COALESCE(trigger_radius, 120)::float
               )
             ORDER BY dist_m ASC
             LIMIT 5`,
            [lat, lng]
        );
        rows = result.rows || [];
    } catch (err) {
        if (err.code !== '42P01') console.warn('POI proximity check failed:', err.message);
        return [];
    }

    const notified = [];
    const now = Date.now();
    for (const poi of rows) {
        const key = cooldownKey(userId, poi.location_id);
        if (now - (cooldown.get(key) || 0) < cooldownMs) continue;
        cooldown.set(key, now);
        await notifyProximityAlert(userId, poi.name, Number(poi.dist_m || 0));
        notified.push({ location_id: poi.location_id, name: poi.name, distance_m: Math.round(Number(poi.dist_m || 0)) });
    }
    return notified;
}

module.exports = { checkPoiProximityAndNotify };
