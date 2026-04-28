// backend/src/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { REQUIREMENTS } = require('../config/requirements');
const { authenticateJWT } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { sendPasswordResetEmail } = require('../services/emailService');
const crypto = require('crypto');

// Get JWT secret with production enforcement
function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    const isProd = process.env.NODE_ENV === 'production';
    
    if (!secret || secret.includes('bwindi') || secret.includes('secret')) {
        if (isProd) {
            throw new Error('CRITICAL: JWT_SECRET must be set to a strong, unique value in production');
        }
    }
    
    return secret || 'bwindi-dev-key-change-in-production';
}

const JWT_SECRET = getJwtSecret();
const BCRYPT_ROUNDS = REQUIREMENTS.security.bcryptRounds || 12;
const REFRESH_JWT_SECRET = process.env.JWT_REFRESH_SECRET || `${JWT_SECRET}-refresh`;
const MFA_JWT_SECRET = process.env.JWT_MFA_SECRET || `${JWT_SECRET}-mfa`;
const ACCESS_TOKEN_TTL = REQUIREMENTS.security.jwtAccessTtl || '24h';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TTL || '7d';
const ENFORCE_PARK_GEOFENCE =
    process.env.ENFORCE_PARK_GEOFENCE === 'true' || process.env.NODE_ENV === 'production';

function getRequestCoordinates(req) {
    const lat = Number(req.body?.lat ?? req.headers['x-user-lat']);
    const lng = Number(req.body?.lng ?? req.headers['x-user-lng']);
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

function createAccessToken(userId, userType) {
    return jwt.sign({ userId, userType }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function createRefreshToken(userId, userType) {
    return jwt.sign({ userId, userType, typ: 'refresh' }, REFRESH_JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
}

function base32Decode(secret) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = (secret || '').toUpperCase().replace(/=+$/g, '');
    let bits = '';
    for (const ch of clean) {
        const value = alphabet.indexOf(ch);
        if (value < 0) continue;
        bits += value.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
    return Buffer.from(bytes);
}

function generateBase32Secret(size = 20) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bytes = crypto.randomBytes(size);
    let output = '';
    let value = 0;
    let bits = 0;
    for (const byte of bytes) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += alphabet[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
    return output;
}

function generateTotp(secret, timestamp = Date.now(), stepSeconds = 30, digits = 6) {
    const key = base32Decode(secret);
    const counter = Math.floor(timestamp / 1000 / stepSeconds);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));
    const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    const otp = (code % (10 ** digits)).toString().padStart(digits, '0');
    return otp;
}

function verifyTotp(secret, providedCode, windowSteps = 1) {
    const code = String(providedCode || '').trim();
    if (!/^\d{6}$/.test(code)) return false;
    for (let drift = -windowSteps; drift <= windowSteps; drift += 1) {
        const candidate = generateTotp(secret, Date.now() + drift * 30000);
        if (candidate === code) return true;
    }
    return false;
}

// =====================================================
// POST /api/auth/register
// =====================================================
router.post('/register', [
    body('username').isLength({ min: 3 }).trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 4 }),
    body('phone').optional().trim(),
    body('userType').optional().isIn(['tourist', 'guide', 'it_manager'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, firstName, lastName, phone, userType } = req.body;

    try {
        // Check if user exists
        const existing = await pool.query(
            'SELECT user_id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );
        
        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // Insert user
        const result = await pool.query(
            `INSERT INTO users (user_id, username, password_hash, email, first_name, last_name, phone, user_type, is_active)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true)
             RETURNING user_id, username, email, user_type`,
            [username, hashedPassword, email, firstName || '', lastName || '', phone || null, userType || 'tourist']
        );

        const user = result.rows[0];

        if (user.user_type === 'tourist') {
            await pool.query(
                `INSERT INTO tourists (user_id, interests)
                 VALUES ($1, $2)`,
                [user.user_id, '[]']
            );
        } else if (user.user_type === 'guide') {
            await pool.query(
                `INSERT INTO tour_guides (user_id, license_number, specialization, languages)
                 VALUES ($1, $2, $3, $4)`,
                [user.user_id, `GUIDE-${Date.now()}`, '[]', '[]']
            );
        } else if (user.user_type === 'it_manager') {
            await pool.query(
                `INSERT INTO it_managers (user_id, employee_id, access_level)
                 VALUES ($1, $2, $3)`,
                [user.user_id, `ITM-${Date.now()}`, 'admin']
            );
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                role: user.user_type
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// =====================================================
// POST /api/auth/login
// =====================================================
router.post('/login', [
    body('username').trim(),
    body('password').notEmpty(),
    body('lat').optional().isFloat(),
    body('lng').optional().isFloat()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const password = req.body.password;
    const identifier = String(req.body.username || req.body.email || '').trim();

    try {
        if (!identifier) {
            return res.status(400).json({ error: 'Username or email is required' });
        }

        const result = await pool.query(
            `SELECT user_id, username, password_hash, user_type, first_name, last_name, is_active, email
             FROM users
             WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
             LIMIT 1`,
            [identifier]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(401).json({ error: 'Account deactivated' });
        }

        let isValid = false;
        const currentHash = user.password_hash || '';

        // Normal path: bcrypt hash verification.
        if (typeof currentHash === 'string' && currentHash.startsWith('$2')) {
            isValid = await bcrypt.compare(password, currentHash);
        } else if (currentHash && currentHash === password) {
            // Legacy compatibility path: one-time migration from plain text storage.
            isValid = true;
            const upgradedHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
            await pool.query(
                `UPDATE users SET password_hash = $1 WHERE user_id = $2`,
                [upgradedHash, user.user_id]
            );
        }
        
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const coordinates = getRequestCoordinates(req);
        if (ENFORCE_PARK_GEOFENCE && !coordinates) {
            return res.status(400).json({
                error: 'Location required',
                message: 'Latitude and longitude are required for park access validation'
            });
        }

        if (coordinates) {
            const insidePark = await isInsidePark(coordinates.lat, coordinates.lng);
            if (!insidePark) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You must be within park boundaries to access SIGTS'
                });
            }

            await pool.query(
                `UPDATE users
                 SET last_lat = $1, last_lng = $2, last_login = CURRENT_TIMESTAMP
                 WHERE user_id = $3`,
                [coordinates.lat, coordinates.lng, user.user_id]
            );
        }

        if (user.user_type === 'it_manager') {
            const mfaResult = await pool.query(
                `SELECT mfa_secret, enabled
                 FROM user_mfa_configs
                 WHERE user_id = $1`,
                [user.user_id]
            );

            if (mfaResult.rows[0]?.enabled) {
                const mfaToken = jwt.sign(
                    { userId: user.user_id, userType: user.user_type, typ: 'mfa_pending' },
                    MFA_JWT_SECRET,
                    { expiresIn: '10m' }
                );

                return res.json({
                    success: true,
                    mfaRequired: true,
                    mfaToken,
                    user: {
                        id: user.user_id,
                        username: user.username,
                        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                        role: user.user_type
                    }
                });
            }
        }

        const accessToken = createAccessToken(user.user_id, user.user_type);
        const refreshToken = createRefreshToken(user.user_id, user.user_type);

        res.json({
            success: true,
            token: accessToken,
            accessToken,
            refreshToken,
            user: {
                id: user.user_id,
                username: user.username,
                name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                role: user.user_type
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// =====================================================
// POST /api/auth/forgot-password
// =====================================================
router.post('/forgot-password', [
    body('email').isEmail().normalizeEmail()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const email = req.body.email;

    try {
        const userResult = await pool.query(
            `SELECT user_id, username, email
             FROM users
             WHERE email = $1
             LIMIT 1`,
            [email]
        );

        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

            await pool.query(
                `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                 VALUES ($1, $2, $3)`,
                [user.user_id, tokenHash, expiresAt]
            );

            await sendPasswordResetEmail(user.email, rawToken, user.username);
        }

        return res.json({
            success: true,
            message: 'If an account exists for this email, a reset link has been sent'
        });
    } catch (error) {
        logger.error('Forgot password failed:', error.message);
        return res.status(500).json({ error: 'Failed to process password reset request' });
    }
});

// =====================================================
// POST /api/auth/reset-password
// =====================================================
router.post('/reset-password', [
    body('token').notEmpty(),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { token, password } = req.body;

    try {
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const resetResult = await pool.query(
            `SELECT reset_id, user_id
             FROM password_reset_tokens
             WHERE token_hash = $1
               AND used_at IS NULL
               AND expires_at > CURRENT_TIMESTAMP
             LIMIT 1`,
            [tokenHash]
        );

        if (resetResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const reset = resetResult.rows[0];
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        await pool.query(
            `UPDATE users
             SET password_hash = $1
             WHERE user_id = $2`,
            [hashedPassword, reset.user_id]
        );

        await pool.query(
            `UPDATE password_reset_tokens
             SET used_at = CURRENT_TIMESTAMP
             WHERE reset_id = $1`,
            [reset.reset_id]
        );

        return res.json({ success: true, message: 'Password has been reset successfully' });
    } catch (error) {
        logger.error('Reset password failed:', error.message);
        return res.status(500).json({ error: 'Failed to reset password' });
    }
});

// =====================================================
// POST /api/auth/refresh
// =====================================================
router.post('/refresh', [
    body('refreshToken').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { refreshToken } = req.body;
        const decoded = jwt.verify(refreshToken, REFRESH_JWT_SECRET);

        const userResult = await pool.query(
            `SELECT user_id, user_type, is_active
             FROM users
             WHERE user_id = $1`,
            [decoded.userId]
        );

        if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const user = userResult.rows[0];
        const accessToken = createAccessToken(user.user_id, user.user_type);
        const rotatedRefreshToken = createRefreshToken(user.user_id, user.user_type);

        return res.json({
            success: true,
            accessToken,
            refreshToken: rotatedRefreshToken
        });
    } catch (error) {
        return res.status(401).json({ error: 'Invalid refresh token' });
    }
});

// =====================================================
// POST /api/auth/mfa/setup
// IT manager configures authenticator-based MFA
// =====================================================
router.post('/mfa/setup', authenticateJWT, async (req, res) => {
    if (req.user.user_type !== 'it_manager') {
        return res.status(403).json({ error: 'MFA setup is currently restricted to IT manager accounts' });
    }

    try {
        const secret = generateBase32Secret();
        const label = encodeURIComponent(`SIGTS:${req.user.username || req.user.email || req.user.user_id}`);
        const issuer = encodeURIComponent('SIGTS');
        const otpauthUrl = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

        await pool.query(
            `INSERT INTO user_mfa_configs (user_id, mfa_secret, enabled, updated_at)
             VALUES ($1, $2, false, CURRENT_TIMESTAMP)
             ON CONFLICT (user_id)
             DO UPDATE SET mfa_secret = EXCLUDED.mfa_secret, enabled = false, updated_at = CURRENT_TIMESTAMP`,
            [req.user.user_id, secret]
        );

        return res.json({
            success: true,
            method: 'authenticator',
            secret,
            otpauthUrl,
            message: 'Scan this secret in your authenticator app and verify one code to enable MFA'
        });
    } catch (error) {
        logger.error('MFA setup failed:', error.message);
        return res.status(500).json({ error: 'Failed to initialize MFA setup' });
    }
});

// =====================================================
// POST /api/auth/mfa/verify-setup
// =====================================================
router.post('/mfa/verify-setup', authenticateJWT, [
    body('code').notEmpty()
], async (req, res) => {
    if (req.user.user_type !== 'it_manager') {
        return res.status(403).json({ error: 'MFA setup verification is restricted to IT manager accounts' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const configResult = await pool.query(
            `SELECT mfa_secret
             FROM user_mfa_configs
             WHERE user_id = $1
             LIMIT 1`,
            [req.user.user_id]
        );
        const secret = configResult.rows[0]?.mfa_secret;
        if (!secret) {
            return res.status(400).json({ error: 'MFA setup has not been initialized' });
        }

        if (!verifyTotp(secret, req.body.code)) {
            return res.status(400).json({ error: 'Invalid MFA code' });
        }

        await pool.query(
            `UPDATE user_mfa_configs
             SET enabled = true, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1`,
            [req.user.user_id]
        );

        return res.json({ success: true, message: 'MFA enabled successfully' });
    } catch (error) {
        logger.error('MFA verify setup failed:', error.message);
        return res.status(500).json({ error: 'Failed to verify MFA setup' });
    }
});

// =====================================================
// POST /api/auth/mfa/complete
// Completes login when mfaRequired is returned
// =====================================================
router.post('/mfa/complete', [
    body('mfaToken').notEmpty(),
    body('code').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const decoded = jwt.verify(req.body.mfaToken, MFA_JWT_SECRET);
        if (decoded.typ !== 'mfa_pending') {
            return res.status(401).json({ error: 'Invalid MFA session' });
        }

        const userResult = await pool.query(
            `SELECT user_id, username, first_name, last_name, user_type, is_active
             FROM users
             WHERE user_id = $1
             LIMIT 1`,
            [decoded.userId]
        );
        if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
            return res.status(401).json({ error: 'Invalid MFA session' });
        }

        const configResult = await pool.query(
            `SELECT mfa_secret, enabled
             FROM user_mfa_configs
             WHERE user_id = $1
             LIMIT 1`,
            [decoded.userId]
        );
        const config = configResult.rows[0];
        if (!config?.enabled) {
            return res.status(400).json({ error: 'MFA is not enabled for this account' });
        }

        if (!verifyTotp(config.mfa_secret, req.body.code)) {
            return res.status(401).json({ error: 'Invalid MFA code' });
        }

        const user = userResult.rows[0];
        const accessToken = createAccessToken(user.user_id, user.user_type);
        const refreshToken = createRefreshToken(user.user_id, user.user_type);

        return res.json({
            success: true,
            token: accessToken,
            accessToken,
            refreshToken,
            user: {
                id: user.user_id,
                username: user.username,
                name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                role: user.user_type
            }
        });
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired MFA session' });
    }
});

// =====================================================
// POST /api/auth/guest
// =====================================================
router.post('/guest', [
    body('lat').optional().isFloat(),
    body('lng').optional().isFloat()
], async (req, res) => {
    try {
        const coordinates = getRequestCoordinates(req);
        if (ENFORCE_PARK_GEOFENCE && !coordinates) {
            return res.status(400).json({
                error: 'Location required',
                message: 'Latitude and longitude are required for guest access'
            });
        }

        if (coordinates) {
            const insidePark = await isInsidePark(coordinates.lat, coordinates.lng);
            if (!insidePark) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'Guest access is only available within park boundaries'
                });
            }
        }

        const guestId = crypto.randomUUID();
        const guestUsername = `guest_${Date.now()}`;
        const guestEmail = `${guestUsername}@guest.sigts.local`;
        const tempPasswordHash = await bcrypt.hash(crypto.randomBytes(18).toString('hex'), BCRYPT_ROUNDS);

        const userResult = await pool.query(
            `INSERT INTO users (user_id, username, password_hash, email, user_type, is_active, first_name, last_name, last_lat, last_lng)
             VALUES ($1, $2, $3, $4, 'tourist', true, 'Guest', 'User', $5, $6)
             RETURNING user_id, username, user_type`,
            [guestId, guestUsername, tempPasswordHash, guestEmail, coordinates?.lat ?? null, coordinates?.lng ?? null]
        );

        await pool.query(
            `INSERT INTO tourists (user_id, interests)
             VALUES ($1, '[]'::jsonb)`,
            [guestId]
        );

        const user = userResult.rows[0];
        const accessToken = createAccessToken(user.user_id, user.user_type);
        const refreshToken = createRefreshToken(user.user_id, user.user_type);

        return res.status(201).json({
            success: true,
            token: accessToken,
            accessToken,
            refreshToken,
            user: {
                id: user.user_id,
                username: user.username,
                name: 'Guest User',
                role: user.user_type,
                guest: true
            }
        });
    } catch (error) {
        logger.error('Guest access creation failed:', error.message);
        return res.status(500).json({ error: 'Failed to create guest session' });
    }
});

// =====================================================
// POST /api/auth/deactivate
// =====================================================
router.post('/deactivate', authenticateJWT, async (req, res) => {
    try {
        await pool.query(
            `UPDATE users SET is_active = false WHERE user_id = $1`,
            [req.user.user_id]
        );
        return res.json({ success: true, message: 'Account deactivated successfully' });
    } catch (error) {
        logger.error('Account deactivation failed:', error.message);
        return res.status(500).json({ error: 'Failed to deactivate account' });
    }
});

module.exports = router;
