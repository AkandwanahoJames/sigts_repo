// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { logger } = require('../utils/logger');
const { REQUIREMENTS } = require('../config/requirements');

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
        
        // Verify user still exists and is active
        const result = await pool.query(
            `SELECT user_id, username, email, user_type, is_active, language_pref
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

        // Lightweight auth heartbeat for "currently logged-in users" visibility.
        // We intentionally don't block request flow on heartbeat update errors.
        const headerLat = Number(req.headers['x-user-lat']);
        const headerLng = Number(req.headers['x-user-lng']);
        const hasCoords = Number.isFinite(headerLat) && Number.isFinite(headerLng);
        const heartbeatSql = hasCoords
            ? `UPDATE users
               SET last_location_time = CURRENT_TIMESTAMP,
                   last_lat = $1,
                   last_lng = $2
               WHERE user_id = $3`
            : `UPDATE users
               SET last_location_time = CURRENT_TIMESTAMP
               WHERE user_id = $1`;
        const heartbeatParams = hasCoords
            ? [headerLat, headerLng, result.rows[0].user_id]
            : [result.rows[0].user_id];
        pool.query(heartbeatSql, heartbeatParams).catch((heartbeatError) => {
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
 * Role-Based Access Control middleware
 * @param {...string} roles - Allowed roles
 */
function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                success: false,
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }
        
        if (!roles.includes(req.user.user_type)) {
            return res.status(403).json({ 
                success: false,
                error: 'Access denied',
                message: `Insufficient permissions. Required role: ${roles.join(', ')}`,
                your_role: req.user.user_type
            });
        }
        
        next();
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
    ipWhitelist
};