// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { logger } = require('../utils/logger');
const { touchUserSessionActivity, ensureLastLocationTimeColumn } = require('../utils/sessionPresence');
const { REQUIREMENTS } = require('../config/requirements');

const SESSION_IDLE_MINUTES = Number.isFinite(REQUIREMENTS.security.sessionIdleTimeoutMinutes)
    ? REQUIREMENTS.security.sessionIdleTimeoutMinutes
    : 30;

// Get JWT secret with production enforcement
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    const isProd = process.env.NODE_ENV === 'production';
    
    if (!secret || secret.includes('bwindi') || secret.includes('secret')) {
        if (isProd) {
            throw new Error('CRITICAL: JWT_SECRET must be set to a strong, unique value in production');
        }
        logger.warn('⚠️ WARNING: Using weak JWT_SECRET. Set JWT_SECRET environment variable in production.');
    }
    
    return secret || 'bwindi-dev-key-change-in-production';
}

const JWT_SECRET = getJwtSecret();

/**
 * Generate JWT token for authenticated user
 * @param {string} userId - User ID
 * @param {string} userType - User role (tourist, guide, it_manager)
 * @returns {string} JWT token
 */
function generateToken(userId, userType) {
    return jwt.sign(
        { userId, userType },
        JWT_SECRET,
        { expiresIn: REQUIREMENTS.security.jwtAccessTtl }
    );
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {object} Decoded token payload
 */
function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
}

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if match
 */
async function comparePassword(password, hash) {
    const bcrypt = require('bcryptjs');
    return bcrypt.compare(password, hash);
}

/**
 * Authenticate JWT token middleware
 */
async function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return res.status(401).json({ 
            success: false,
            error: 'Authentication required',
            message: 'No token provided'
        });
    }

    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = verifyToken(token);

        const hasLocCol = await ensureLastLocationTimeColumn();
        const result = await pool.query(
            hasLocCol
                ? `SELECT user_id, username, email, user_type, is_active, language_pref,
                          last_location_time, last_login, created_at,
                          (LOWER(COALESCE(email, '')) LIKE '%@guest.sigts.local') AS is_guest
                   FROM users WHERE user_id = $1`
                : `SELECT user_id, username, email, user_type, is_active, language_pref,
                          NULL::timestamptz AS last_location_time, last_login, created_at,
                          (LOWER(COALESCE(email, '')) LIKE '%@guest.sigts.local') AS is_guest
                   FROM users WHERE user_id = $1`,
            [decoded.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication failed',
                message: 'User not found'
            });
        }
        
        if (!result.rows[0].is_active) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication failed',
                message: 'Account deactivated'
            });
        }
        
        req.user = result.rows[0];

        if (SESSION_IDLE_MINUTES > 0) {
            const row = result.rows[0];
            const lastActivity = row.last_location_time || row.last_login || row.created_at;
            const tokenIssuedMs = decoded.iat ? decoded.iat * 1000 : 0;
            const lastActivityMs = lastActivity ? new Date(lastActivity).getTime() : 0;
            const effectiveActivityMs = Math.max(lastActivityMs, tokenIssuedMs);
            if (effectiveActivityMs > 0) {
                const idleMs = SESSION_IDLE_MINUTES * 60 * 1000;
                if (Date.now() - effectiveActivityMs > idleMs) {
                    return res.status(401).json({
                        success: false,
                        error: 'Session expired',
                        message: `Your session ended after ${SESSION_IDLE_MINUTES} minutes of inactivity. Please sign in again.`,
                        code: 'SESSION_IDLE_EXPIRED'
                    });
                }
            }
        }

        // Lightweight auth heartbeat for IT realtime active-user views.
        const headerLat = Number(req.headers['x-user-lat']);
        const headerLng = Number(req.headers['x-user-lng']);
        const hasCoords = Number.isFinite(headerLat) && Number.isFinite(headerLng);
        touchUserSessionActivity(
            result.rows[0].user_id,
            hasCoords ? { lat: headerLat, lng: headerLng } : null
        ).catch((heartbeatError) => {
            logger.debug('Auth heartbeat update skipped:', heartbeatError.message);
        });

        next();
        
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication failed',
                message: 'Token expired. Please login again.'
            });
        }
        
        logger.error('JWT verification error:', error.message);
        return res.status(403).json({ 
            success: false,
            error: 'Authentication failed',
            message: 'Invalid token'
        });
    }
}

/**
 * Guest sessions (park-only temporary accounts) may browse core content but
 * must not use staff workflows or data sync APIs.
 */
function rejectGuestAccounts(req, res, next) {
    if (req.user?.is_guest) {
        return res.status(403).json({
            success: false,
            error: 'Access denied',
            message: 'Guest sessions cannot use this feature. Create a full account to continue.',
            code: 'GUEST_FORBIDDEN'
        });
    }
    next();
}

/**
 * Canonical role string from users.user_type (handles legacy casing/aliases).
 */
function normalizeUserType(userType) {
    const raw = String(userType || '').trim().toLowerCase();
    if (raw === 'it-manager' || raw === 'itmanager') return 'it_manager';
    return raw;
}

/**
 * True when the account is listed in it_managers (covers mis-typed user_type rows).
 */
async function userHasItManagerRecord(userId) {
    if (!userId) return false;
    try {
        const result = await pool.query(
            `SELECT 1 FROM it_managers WHERE user_id = $1 LIMIT 1`,
            [userId]
        );
        return result.rows.length > 0;
    } catch (_) {
        return false;
    }
}

/**
 * Role-Based Access Control middleware
 * @param {...string} roles - Allowed roles
 */
function authorize(...roles) {
    const allowed = roles.map((r) => normalizeUserType(r));
    const allowsItDesk = allowed.includes('it_manager') || allowed.includes('admin');

    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }

        const role = normalizeUserType(req.user.user_type);
        if (allowed.includes(role)) {
            return next();
        }

        if (allowsItDesk && (await userHasItManagerRecord(req.user.user_id))) {
            return next();
        }

        return res.status(403).json({
            success: false,
            error: 'Access denied',
            message: `Insufficient permissions. Required role: ${allowed.join(', ')}`,
            your_role: role || req.user.user_type || null,
            required_roles: allowed
        });
    };
}

/**
 * IP Whitelist middleware for Bwindi intranet
 */
function ipWhitelist(req, res, next) {
    // Skip in development
    if (process.env.NODE_ENV === 'development') {
        return next();
    }
    
    const clientIp = req.ip || 
                     req.headers['x-forwarded-for']?.split(',')[0] || 
                     req.socket.remoteAddress;
    
    const cleanIp = clientIp.replace('::ffff:', '');
    
    // Bwindi intranet range: 192.168.100.0/24
    const isBwindiIntranet = cleanIp.startsWith('192.168.100');
    
    if (!isBwindiIntranet) {
        return res.status(403).json({
            success: false,
            error: 'ACCESS_DENIED',
            message: 'You must be connected to Bwindi intranet (192.168.100.0/24)',
            your_ip: cleanIp,
            required_network: process.env.INTRANET_SUBNET || '192.168.100.0/24'
        });
    }
    
    req.networkInfo = { ip: cleanIp, isInsidePark: true };
    next();
}

module.exports = {
    generateToken,
    verifyToken,
    hashPassword,
    comparePassword,
    authenticateJWT,
    authorize,
    rejectGuestAccounts,
    ipWhitelist
};