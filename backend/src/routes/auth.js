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
const { audit } = require('../utils/audit');
const { sendPasswordResetEmail, sendActivityNotificationEmail } = require('../services/emailService');
const { notifyUserRegistered } = require('../services/notificationService');
const refreshTokenService = require('../services/refreshTokenService');
const {
    normalizeUsername,
    normalizeEmail,
    isValidEmailShape,
    findRegistrationConflicts,
    findUserForLogin,
    findUserByEmailForLogin,
    registrationConflictResponse,
    mapUniqueViolation
} = require('../utils/userIdentity');
const { resolvePublicAppBaseUrl } = require('../utils/appUrl');
const { touchUserSessionActivity } = require('../utils/sessionPresence');
const crypto = require('crypto');

function clientContext(req) {
    return {
        ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null,
        userAgent: req.headers['user-agent']?.slice(0, 500) || null
    };
}

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
const EMAIL_VERIFICATION_JWT_SECRET = process.env.JWT_EMAIL_VERIFICATION_SECRET || JWT_SECRET;
const ACCESS_TOKEN_TTL = REQUIREMENTS.security.jwtAccessTtl || '24h';
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TTL || '7d';
const ENFORCE_PARK_GEOFENCE =
    process.env.ENFORCE_PARK_GEOFENCE === 'true' || process.env.NODE_ENV === 'production';
const GEOFENCE_BYPASS_ROLES = new Set();
let usersEmailVerifiedReady = null;

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

function parseVerificationToken(token) {
    try {
        const decoded = jwt.verify(String(token || ''), EMAIL_VERIFICATION_JWT_SECRET);
        if (!decoded || decoded.typ !== 'email_verify' || !decoded.sub) return null;
        return { userId: decoded.sub };
    } catch (_) {
        return null;
    }
}

async function ensureUsersEmailVerifiedColumn() {
    if (usersEmailVerifiedReady) return usersEmailVerifiedReady;
    usersEmailVerifiedReady = (async () => {
        await pool.query(
            `ALTER TABLE users
             ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false`
        );
        return true;
    })().catch((error) => {
        usersEmailVerifiedReady = null;
        throw error;
    });
    return usersEmailVerifiedReady;
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
    body('email').trim().isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 4 }),
    body('phone').trim().isLength({ min: 6, max: 32 }).withMessage('Phone number is required'),
    body('userType').optional().isIn(['tourist', 'guide', 'it_manager'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const usernameRaw = req.body.username;
    const emailRaw = req.body.email;
    const password = req.body.password;
    const { firstName, lastName, phone, userType } = req.body;

    const username = normalizeUsername(usernameRaw);
    const email = normalizeEmail(emailRaw);

    if (!isValidEmailShape(email)) {
        return res.status(400).json({ error: 'Valid email required', field: 'email' });
    }
    if (email.endsWith('@guest.sigts.local')) {
        return res.status(400).json({ error: 'This email domain is reserved for temporary guest sessions', field: 'email' });
    }

    const client = await pool.connect();
    try {
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const phoneNorm = String(phone || '').trim();
        const role = userType || 'tourist';

        await client.query('BEGIN');

        const conflicts = await findRegistrationConflicts(client, usernameRaw, emailRaw);
        const conflictResp = registrationConflictResponse(conflicts);
        if (conflictResp) {
            await client.query('ROLLBACK');
            return res.status(conflictResp.status).json(conflictResp.body);
        }

        const result = await client.query(
            `INSERT INTO users (user_id, username, password_hash, email, first_name, last_name, phone, user_type, is_active)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, true)
             RETURNING user_id, username, email, user_type`,
            [username, hashedPassword, email, firstName || '', lastName || '', phoneNorm, role]
        );

        const user = result.rows[0];

        if (user.user_type === 'tourist') {
            await client.query(
                `INSERT INTO tourists (user_id, interests) VALUES ($1, '[]'::jsonb)`,
                [user.user_id]
            );
        } else if (user.user_type === 'guide') {
            await client.query(
                `INSERT INTO tour_guides (user_id, license_number, specialization, languages)
                 VALUES ($1, $2, $3, $4)`,
                [user.user_id, `GUIDE-${Date.now()}`, '[]', '[]']
            );
        } else if (user.user_type === 'it_manager') {
            await client.query(
                `INSERT INTO it_managers (user_id, employee_id, access_level)
                 VALUES ($1, $2, $3)`,
                [user.user_id, `ITM-${Date.now()}`, 'admin']
            );
        }

        await client.query('COMMIT');

        let notifications = { email: false, sms: false, verificationEmail: false };
        try {
            notifications = await notifyUserRegistered({
                email: user.email,
                username: user.username,
                phone: phoneNorm,
                userId: user.user_id
            });
        } catch (notifyErr) {
            logger.error('Registration notifications failed (account created):', notifyErr.message);
        }

        const noticeParts = [];
        if (notifications.email) noticeParts.push(`a welcome message to ${user.email}`);
        if (notifications.verificationEmail) noticeParts.push('a verification link');
        if (notifications.sms) noticeParts.push('SMS');
        const noticeHint = noticeParts.length
            ? ` We sent ${noticeParts.join(' and ')}.`
            : ' You can sign in now.';

        return res.status(201).json({
            success: true,
            code: 'REGISTRATION_SUCCESS',
            message: `Your account was created successfully.${noticeHint}`,
            emailSent: Boolean(notifications.email),
            verificationEmailSent: Boolean(notifications.verificationEmail),
            notifications,
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                role: user.user_type
            }
        });

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        const unique = mapUniqueViolation(error);
        if (unique) {
            return res.status(unique.status).json(unique.body);
        }
        logger.error('Registration error:', error);
        const detail = process.env.NODE_ENV !== 'production' ? error.message : undefined;
        res.status(500).json({
            error: 'Registration failed',
            ...(detail ? { detail } : {})
        });
    } finally {
        client.release();
    }
});

// GET /api/auth/check-availability?username=&email=
router.get('/check-availability', async (req, res) => {
    try {
        const conflicts = await findRegistrationConflicts(
            pool,
            req.query.username || '',
            req.query.email || ''
        );
        const conflictResp = registrationConflictResponse(conflicts);
        return res.json({
            available: !conflictResp,
            usernameAvailable: !conflicts.username,
            emailAvailable: !conflicts.email,
            ...(conflictResp ? { conflict: conflictResp.body } : {})
        });
    } catch (error) {
        logger.error('check-availability error:', error);
        return res.status(500).json({ error: 'Availability check failed' });
    }
});

// =====================================================
// POST /api/auth/verify-email
// =====================================================
router.post('/verify-email', [
    body('token').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const parsed = parseVerificationToken(req.body.token);
    if (!parsed) {
        return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    try {
        await ensureUsersEmailVerifiedColumn();
        const updated = await pool.query(
            `UPDATE users
             SET email_verified = true
             WHERE user_id = $1
             RETURNING user_id, email, username, email_verified`,
            [parsed.userId]
        );

        if (!updated.rows.length) {
            return res.status(404).json({ error: 'User not found for verification token' });
        }

        const user = updated.rows[0];
        sendActivityNotificationEmail(
            user.email,
            user.username,
            'Email verification completed',
            'Your email address has been verified successfully on SIGTS.'
        ).catch((err) => logger.error('Verify-email activity email failed:', err.message));

        return res.json({
            success: true,
            message: 'Email verified successfully',
            email_verified: Boolean(user.email_verified)
        });
    } catch (error) {
        logger.error('Verify email failed:', error.message);
        return res.status(500).json({ error: 'Failed to verify email' });
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

        const loginMatch = await findUserForLogin(pool, identifier);

        if (!loginMatch) {
            return res.status(401).json({ error: 'Invalid credentials', code: 'USER_NOT_FOUND' });
        }

        const user = loginMatch.user;

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
            return res.status(401).json({
                error: 'Incorrect password',
                code: 'INVALID_PASSWORD'
            });
        }

        const coordinates = getRequestCoordinates(req);
        const bypassGeofence = GEOFENCE_BYPASS_ROLES.has(user.user_type);

        if (ENFORCE_PARK_GEOFENCE && !coordinates && !bypassGeofence) {
            return res.status(400).json({
                error: 'Location required',
                message: 'Latitude and longitude are required for park access validation'
            });
        }

        if (coordinates && ENFORCE_PARK_GEOFENCE && !bypassGeofence) {
            const insidePark = await isInsidePark(coordinates.lat, coordinates.lng);
            if (!insidePark) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You must be within park boundaries to access SIGTS'
                });
            }
        }

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

            const phoneRow = await pool.query(`SELECT phone FROM users WHERE user_id = $1`, [user.user_id]);
            return res.json({
                success: true,
                mfaRequired: true,
                mfaToken,
                smsMfaAvailable: Boolean((phoneRow.rows[0]?.phone || '').trim()),
                user: {
                    id: user.user_id,
                    username: user.username,
                    email: user.email,
                    name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                    role: user.user_type
                }
            });
        }

        const accessToken = createAccessToken(user.user_id, user.user_type);
        const { token: refreshToken } = await refreshTokenService.issueNewFamily(
            user.user_id,
            user.user_type,
            clientContext(req)
        );

        await touchUserSessionActivity(user.user_id, coordinates);

        res.json({
            success: true,
            token: accessToken,
            accessToken,
            refreshToken,
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email,
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

    const email = normalizeEmail(req.body.email);

    try {
        const userRow = await findUserByEmailForLogin(pool, email);

        if (userRow) {
            const user = userRow;
            const rawToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

            await pool.query(
                `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                 VALUES ($1, $2, $3)`,
                [user.user_id, tokenHash, expiresAt]
            );

            const base = resolvePublicAppBaseUrl();
            const resetUrl = `${base}/reset-password?token=${rawToken}`;
            const emailSent = await sendPasswordResetEmail(user.email, rawToken, user.username);
            sendActivityNotificationEmail(
                user.email,
                user.username,
                'Password reset requested',
                'We received a password reset request for your account. If this was not you, secure your account immediately.'
            ).catch((err) => logger.error('Password-reset-request activity email failed:', err.message));

            if (!emailSent && process.env.NODE_ENV !== 'production') {
                logger.info(`Password reset (dev, email not sent): ${resetUrl}`);
                return res.json({
                    success: true,
                    message: 'Password reset link created. Email is not configured in this environment.',
                    devResetUrl: resetUrl
                });
            }
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
        const userResult = await pool.query(
            `SELECT email, username
             FROM users
             WHERE user_id = $1
             LIMIT 1`,
            [reset.user_id]
        );

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

        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            sendActivityNotificationEmail(
                user.email,
                user.username,
                'Your password was changed',
                'Your SIGTS password has been reset successfully. If you did not perform this action, contact support immediately.'
            ).catch((err) => logger.error('Password-reset-complete activity email failed:', err.message));
        }

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

        let rotated;
        try {
            rotated = await refreshTokenService.rotateToken(refreshToken, clientContext(req));
        } catch (rotationError) {
            const code = rotationError.code || 'UNKNOWN';
            // 401 for the client; the service layer already logs reuse-detected
            // events as warnings.
            return res.status(401).json({
                error: 'Invalid refresh token',
                code
            });
        }

        const decoded = jwt.verify(rotated.token, REFRESH_JWT_SECRET);
        const userResult = await pool.query(
            `SELECT user_id, user_type, is_active
             FROM users
             WHERE user_id = $1`,
            [decoded.userId]
        );

        if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
            // Revoke the family we just issued — user is gone/disabled.
            await refreshTokenService.revokeFamily(rotated.familyId, 'user_inactive');
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const user = userResult.rows[0];
        const accessToken = createAccessToken(user.user_id, user.user_type);
        await touchUserSessionActivity(user.user_id, getRequestCoordinates(req));

        return res.json({
            success: true,
            token: accessToken,
            accessToken,
            refreshToken: rotated.token
        });
    } catch (error) {
        logger.error('Refresh handler error', { error: error.message });
        return res.status(401).json({ error: 'Invalid refresh token' });
    }
});

// =====================================================
// POST /api/auth/mfa/setup
// Authenticator-based MFA (optional for tourist, guide, and IT manager)
// =====================================================
router.post('/mfa/setup', authenticateJWT, async (req, res) => {
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
            `SELECT user_id, username, email, first_name, last_name, user_type, is_active
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
        const { token: refreshToken } = await refreshTokenService.issueNewFamily(
            user.user_id,
            user.user_type,
            clientContext(req)
        );

        await touchUserSessionActivity(user.user_id, getRequestCoordinates(req));

        return res.json({
            success: true,
            token: accessToken,
            accessToken,
            refreshToken,
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                role: user.user_type
            }
        });
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired MFA session' });
    }
});

// =====================================================
// POST /api/auth/mfa/sms/send — optional SMS ladder during MFA login (3.1.1.1)
// Requires phone on profile; integrates with Twilio when env vars provided.
// =====================================================
router.post('/mfa/sms/send', [body('mfaToken').notEmpty()], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
        const decoded = jwt.verify(req.body.mfaToken, MFA_JWT_SECRET);
        if (decoded.typ !== 'mfa_pending') {
            return res.status(401).json({ error: 'Invalid MFA session' });
        }
        const u = await pool.query(
            `SELECT user_id, phone, user_type FROM users WHERE user_id = $1 AND is_active = true`,
            [decoded.userId]
        );
        if (!u.rows.length) {
            return res.status(401).json({ error: 'Invalid MFA session' });
        }
        const rawPhone = String(u.rows[0].phone || '').trim();
        if (!rawPhone) {
            return res.status(400).json({ error: 'Add a mobile phone number to your profile before using SMS MFA.' });
        }

        let tableReady = false;
        try {
            const chk = await pool.query(`
                SELECT 1 FROM information_schema.tables
                WHERE table_schema='public' AND table_name='sms_mfa_challenges'
            `);
            tableReady = chk.rows.length > 0;
        } catch (_) {
            tableReady = false;
        }
        if (!tableReady) {
            return res.status(503).json({ error: 'SMS MFA storage missing; apply migration 011_capability_extensions.sql' });
        }

        const code = String(Math.floor(100000 + Math.random() * 900000));
        const hash = await bcrypt.hash(code, BCRYPT_ROUNDS);
        await pool.query(
            `UPDATE sms_mfa_challenges SET consumed = true WHERE user_id = $1 AND consumed = false`,
            [decoded.userId]
        );
        await pool.query(
            `INSERT INTO sms_mfa_challenges (user_id, code_hash, expires_at)
             VALUES ($1, $2, NOW() + INTERVAL '12 minutes')`,
            [decoded.userId, hash]
        );

        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER) {
            try {
                // eslint-disable-next-line global-require, import/no-extraneous-dependencies
                const twilio = require('twilio');
                const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                await client.messages.create({
                    body: `SIGTS MFA code: ${code}. Expires in 12 minutes.`,
                    from: process.env.TWILIO_FROM_NUMBER,
                    to: rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`
                });
            } catch (twErr) {
                logger.warn('Twilio SMS send failed', twErr.message);
                return res.status(502).json({ error: 'SMS provider refused the message. Use authenticator OTP or try again.' });
            }
        } else {
            logger.info(`SMS MFA stub: code for user ${decoded.userId} digits=${code}`);
        }

        const devReturn = process.env.NODE_ENV !== 'production' && process.env.SMS_MFA_DEV_RETURN === 'true';

        return res.json({
            success: true,
            sent: Boolean(process.env.TWILIO_ACCOUNT_SID) || devReturn || process.env.NODE_ENV !== 'production',
            message: devReturn ? 'Returning code because SMS_MFA_DEV_RETURN=true (non-production).' : 'Code dispatched per provider logs.',
            devSmsCode: devReturn ? code : undefined
        });
    } catch (err) {
        logger.warn('SMS MFA send rejected', err.message);
        return res.status(401).json({ error: 'Invalid MFA session token' });
    }
});

router.post('/mfa/sms/complete', [
    body('mfaToken').notEmpty(),
    body('code').matches(/^\d{6}$/)
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
        const decoded = jwt.verify(req.body.mfaToken, MFA_JWT_SECRET);
        if (decoded.typ !== 'mfa_pending') {
            return res.status(401).json({ error: 'Invalid MFA session' });
        }
        const chk = await pool.query(`
            SELECT 1 FROM information_schema.tables
            WHERE table_schema='public' AND table_name='sms_mfa_challenges'
        `);
        if (!chk.rows.length) {
            return res.status(503).json({ error: 'sms_mfa_challenges missing' });
        }
        const rows = await pool.query(
            `SELECT challenge_id, code_hash FROM sms_mfa_challenges
             WHERE user_id = $1 AND consumed = false AND expires_at > NOW()
             ORDER BY created_at DESC
             LIMIT 1`,
            [decoded.userId]
        );
        const row = rows.rows[0];
        if (!row || !(await bcrypt.compare(String(req.body.code).trim(), row.code_hash))) {
            return res.status(401).json({ error: 'Invalid or expired SMS code' });
        }
        await pool.query(`UPDATE sms_mfa_challenges SET consumed = true WHERE challenge_id = $1`, [row.challenge_id]);

        const userResult = await pool.query(
            `SELECT user_id, username, email, first_name, last_name, user_type
             FROM users WHERE user_id = $1`,
            [decoded.userId]
        );
        const user = userResult.rows[0];
        const accessToken = createAccessToken(user.user_id, user.user_type);
        const { token: refreshToken } = await refreshTokenService.issueNewFamily(
            user.user_id,
            user.user_type,
            clientContext(req)
        );
        await touchUserSessionActivity(user.user_id, getRequestCoordinates(req));
        return res.json({
            success: true,
            token: accessToken,
            accessToken,
            refreshToken,
            user: {
                id: user.user_id,
                username: user.username,
                email: user.email,
                name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
                role: user.user_type
            }
        });
    } catch (err) {
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
        const { token: refreshToken } = await refreshTokenService.issueNewFamily(
            user.user_id,
            user.user_type,
            clientContext(req)
        );

        await touchUserSessionActivity(user.user_id, coordinates);

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
// POST /api/auth/presence
// Lightweight session heartbeat for IT realtime active-user views.
// =====================================================
router.post('/presence', authenticateJWT, async (req, res) => {
    try {
        const headerLat = Number(req.headers['x-user-lat'] ?? req.body?.lat);
        const headerLng = Number(req.headers['x-user-lng'] ?? req.body?.lng);
        const hasCoords = Number.isFinite(headerLat) && Number.isFinite(headerLng);
        const ok = await touchUserSessionActivity(
            req.user.user_id,
            hasCoords ? { lat: headerLat, lng: headerLng } : null
        );
        if (!ok) {
            return res.status(500).json({ error: 'Presence update failed' });
        }
        return res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error) {
        logger.error('Presence heartbeat failed:', error.message);
        return res.status(500).json({ error: 'Presence update failed' });
    }
});

// =====================================================
// POST /api/auth/deactivate
// =====================================================
router.post('/deactivate', authenticateJWT, async (req, res) => {
    try {
        if (req.user.is_guest) {
            return res.status(400).json({
                error: 'Guest sessions cannot be deactivated',
                message: 'Sign out to end a guest session.'
            });
        }

        const confirmed = req.body?.confirm === true || req.body?.confirm === 'true';
        if (!confirmed) {
            return res.status(400).json({
                error: 'Confirmation required',
                message: 'Send { "confirm": true } to deactivate your account.',
                code: 'CONFIRM_REQUIRED'
            });
        }

        const userResult = await pool.query(
            `SELECT user_id, email, username, is_active
             FROM users
             WHERE user_id = $1
             LIMIT 1`,
            [req.user.user_id]
        );

        const prev = userResult.rows[0] || null;

        await refreshTokenService.revokeAllFamiliesForUser(req.user.user_id, 'account_deactivated');

        await pool.query(
            `UPDATE users SET is_active = false WHERE user_id = $1`,
            [req.user.user_id]
        );

        if (prev) {
            await audit(req, {
                action: 'user.self_deactivate',
                table_name: 'users',
                record_id: req.user.user_id,
                old_value: prev,
                new_value: { ...prev, is_active: false }
            });
        }

        if (userResult.rows.length > 0) {
            const user = userResult.rows[0];
            sendActivityNotificationEmail(
                user.email,
                user.username,
                'Your account was deactivated',
                'Your SIGTS account has been deactivated. If this was not initiated by you, contact the IT manager immediately.'
            ).catch((err) => logger.error('Account-deactivate activity email failed:', err.message));
        }
        return res.json({ success: true, message: 'Account deactivated successfully' });
    } catch (error) {
        logger.error('Account deactivation failed:', error.message);
        return res.status(500).json({ error: 'Failed to deactivate account' });
    }
});

module.exports = router;
