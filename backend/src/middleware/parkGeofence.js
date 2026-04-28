const { pool } = require('../config/database');

const ENFORCE_PARK_GEOFENCE =
    process.env.ENFORCE_PARK_GEOFENCE === 'true' || process.env.NODE_ENV === 'production';

function readCoordinates(req) {
    const lat = Number(req.body?.lat ?? req.query?.lat ?? req.headers['x-user-lat']);
    const lng = Number(req.body?.lng ?? req.query?.lng ?? req.headers['x-user-lng']);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

async function isInsidePark(lat, lng) {
    const result = await pool.query(
        `SELECT ST_Contains(
            geofence_boundary,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)
         ) AS is_inside
         FROM parks
         LIMIT 1`,
        [lng, lat]
    );
    return result.rows[0]?.is_inside === true;
}

function requireInsidePark(options = {}) {
    const bypassRoles = options.bypassRoles || [];
    const requireCoordinates = options.requireCoordinates !== false;

    return async (req, res, next) => {
        if (!ENFORCE_PARK_GEOFENCE) return next();

        const role = req.user?.user_type;
        if (role && bypassRoles.includes(role)) return next();

        const coordinates = readCoordinates(req);
        if (!coordinates) {
            if (!requireCoordinates) return next();
            return res.status(400).json({
                error: 'Location required',
                message: 'Latitude and longitude are required for park boundary validation'
            });
        }

        try {
            const inside = await isInsidePark(coordinates.lat, coordinates.lng);
            if (!inside) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'This operation is only available within park boundaries'
                });
            }

            req.geofence = { insidePark: true, ...coordinates };
            next();
        } catch (error) {
            return res.status(500).json({ error: 'Failed to validate geofence boundary' });
        }
    };
}

module.exports = {
    ENFORCE_PARK_GEOFENCE,
    readCoordinates,
    isInsidePark,
    requireInsidePark
};
