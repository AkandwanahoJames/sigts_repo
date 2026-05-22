// backend/src/routes/users.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateJWT, authorize, rejectGuestAccounts } = require('../middleware/auth');
const { canViewMedicalNotes } = require('../services/medicalNotesAccess');
const { audit } = require('../utils/audit');
const refreshTokenService = require('../services/refreshTokenService');
const { uploadSingle } = require('../middleware/upload');
let usersEmailVerifiedReady = null;

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

// =====================================================
// GET /api/users/profile
// Get current user profile
// =====================================================
router.get('/profile', authenticateJWT, async (req, res) => {
    const userId = req.user.user_id;

    try {
        await ensureUsersEmailVerifiedColumn();
        // Get base user info
        const userResult = await pool.query(
            `SELECT user_id, username, email, phone, first_name, last_name, 
                    user_type, created_at, last_login, profile_pic_url,
                    email_verified
             FROM users WHERE user_id = $1`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const profile = userResult.rows[0];

        // Get role-specific data
        if (profile.user_type === 'tourist') {
            const touristData = await pool.query(
                `SELECT nationality, date_of_birth, interests, total_visits,
                        emergency_contact_name, emergency_contact_phone
                 FROM tourists WHERE user_id = $1`,
                [userId]
            );
            if (touristData.rows.length > 0) {
                profile.role_data = touristData.rows[0];
            }
        } else if (profile.user_type === 'guide') {
            const guideData = await pool.query(
                `SELECT license_number, specialization, years_of_experience AS years_experience, languages,
                        certification_level, average_rating, total_tours_conducted
                 FROM tour_guides WHERE user_id = $1`,
                [userId]
            );
            if (guideData.rows.length > 0) {
                profile.role_data = guideData.rows[0];
            }
        } else if (profile.user_type === 'it_manager' || profile.user_type === 'admin') {
            const adminData = await pool.query(
                `SELECT employee_id, department, access_level
                 FROM it_managers WHERE user_id = $1`,
                [userId]
            );
            if (adminData.rows.length > 0) {
                profile.role_data = adminData.rows[0];
            }
        }

        res.json(profile);

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

// =====================================================
// PUT /api/users/profile
// Update user profile
// =====================================================
router.put('/profile', authenticateJWT, rejectGuestAccounts, [
    body('firstName').optional().trim().escape(),
    body('lastName').optional().trim().escape(),
    body('phone').optional().trim(),
    body('nationality').optional().trim(),
    body('interests').optional().isArray()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.user_id;
    const { firstName, lastName, phone, profile_pic_url, nationality, interests } = req.body;

    try {
        // Update base user info
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (firstName !== undefined) {
            updates.push(`first_name = $${paramIndex++}`);
            values.push(firstName);
        }
        if (lastName !== undefined) {
            updates.push(`last_name = $${paramIndex++}`);
            values.push(lastName);
        }
        if (phone !== undefined) {
            updates.push(`phone = $${paramIndex++}`);
            values.push(phone);
        }
        if (profile_pic_url !== undefined) {
            updates.push(`profile_pic_url = $${paramIndex++}`);
            values.push(profile_pic_url);
        }

        if (updates.length > 0) {
            values.push(userId);
            await pool.query(
                `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${paramIndex}`,
                values
            );
        }

        // Update tourist-specific data
        if (req.user.user_type === 'tourist' && (nationality !== undefined || interests !== undefined)) {
            const touristUpdates = [];
            const touristValues = [];
            let touristIndex = 1;

            if (nationality !== undefined) {
                touristUpdates.push(`nationality = $${touristIndex++}`);
                touristValues.push(nationality);
            }
            if (interests !== undefined) {
                touristUpdates.push(`interests = $${touristIndex++}`);
                touristValues.push(JSON.stringify(interests));
            }

            if (touristUpdates.length > 0) {
                touristValues.push(userId);
                await pool.query(
                    `UPDATE tourists SET ${touristUpdates.join(', ')} WHERE user_id = $${touristIndex}`,
                    touristValues
                );
            }
        }

        // Get updated profile
        const updatedResult = await pool.query(
            `SELECT user_id, username, email, phone, first_name, last_name, user_type,
                    profile_pic_url
             FROM users WHERE user_id = $1`,
            [userId]
        );

        res.json(updatedResult.rows[0]);

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// =====================================================
// POST /api/users/profile/photo
// Upload profile picture (stored under /uploads/profiles)
// =====================================================
router.post(
    '/profile/photo',
    authenticateJWT,
    rejectGuestAccounts,
    (req, res, next) => {
        uploadSingle('profile_pic')(req, res, (err) => {
            if (err) {
                return res.status(400).json({ error: err.message || 'Invalid file upload' });
            }
            next();
        });
    },
    async (req, res) => {
        const userId = req.user.user_id;
        try {
            if (!req.file?.filename) {
                return res.status(400).json({ error: 'No image file provided' });
            }
            const oldRow = await pool.query('SELECT profile_pic_url FROM users WHERE user_id = $1', [userId]);
            const oldUrl = oldRow.rows[0]?.profile_pic_url;
            const relative = `/uploads/profiles/${req.file.filename}`;

            try {
                if (oldUrl && typeof oldUrl === 'string' && oldUrl.startsWith('/uploads/profiles/')) {
                    const relPath = oldUrl.replace(/^\//, '');
                    const abs = path.join(__dirname, '../../', relPath);
                    if (fs.existsSync(abs)) fs.unlinkSync(abs);
                }
            } catch (_) {
                /* non-fatal */
            }

            await pool.query('UPDATE users SET profile_pic_url = $1 WHERE user_id = $2', [relative, userId]);
            const updatedResult = await pool.query(
                `SELECT user_id, username, email, phone, first_name, last_name, user_type,
                        profile_pic_url
                 FROM users WHERE user_id = $1`,
                [userId]
            );
            res.json(updatedResult.rows[0]);
        } catch (error) {
            console.error('Profile photo upload error:', error);
            res.status(500).json({ error: 'Failed to save profile photo' });
        }
    }
);

// =====================================================
// GET /api/users/me/consents
// Returns the user's most recent record per consent_type.
// =====================================================
router.get('/me/consents', authenticateJWT, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT DISTINCT ON (consent_type)
                consent_type, granted, granted_at, revoked_at, policy_version
             FROM consent_log
             WHERE user_id = $1
             ORDER BY consent_type, granted_at DESC`,
            [req.user.user_id]
        );
        res.json({ consents: result.rows });
    } catch (error) {
        console.error('Get consents error:', error);
        res.status(500).json({ error: 'Failed to fetch consents' });
    }
});

// =====================================================
// POST /api/users/me/consents
// Body: { consent_type, granted, policy_version? }
// Inserts a new immutable row reflecting the user's choice.
// =====================================================
router.post(
    '/me/consents',
    authenticateJWT,
    [
        body('consent_type').isIn([
            'location_tracking',
            'analytics',
            'push_notifications',
            'cultural_content_imagery'
        ]),
        body('granted').isBoolean(),
        body('policy_version').optional().isString().isLength({ max: 20 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { consent_type, granted, policy_version } = req.body;
        const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || null;

        try {
            // If revoking, also stamp revoked_at on the previous active grant.
            if (!granted) {
                await pool.query(
                    `UPDATE consent_log
                     SET revoked_at = CURRENT_TIMESTAMP
                     WHERE user_id = $1 AND consent_type = $2 AND revoked_at IS NULL`,
                    [req.user.user_id, consent_type]
                );
            }

            await pool.query(
                `INSERT INTO consent_log
                    (user_id, consent_type, granted, ip_address, user_agent, policy_version)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    req.user.user_id,
                    consent_type,
                    granted,
                    ip,
                    req.headers['user-agent']?.slice(0, 500) || null,
                    policy_version || null
                ]
            );

            res.json({ success: true, consent_type, granted });
        } catch (error) {
            console.error('Set consent error:', error);
            res.status(500).json({ error: 'Failed to record consent' });
        }
    }
);

// =====================================================
// GET /api/users/:id/medical-notes
// Field-level access control. Returns medical_notes only if the requesting
// user is the tourist themselves, an IT manager, or a guide currently
// assigned to an ongoing tour the tourist is on.
// =====================================================
router.get('/:id/medical-notes', authenticateJWT, async (req, res) => {
    const targetUserId = req.params.id;

    try {
        const allowed = await canViewMedicalNotes({
            requestingUser: req.user,
            touristUserId: targetUserId
        });

        if (!allowed) {
            return res.status(403).json({
                error: 'Access denied',
                code: 'MEDICAL_NOTES_FORBIDDEN'
            });
        }

        const result = await pool.query(
            `SELECT t.medical_notes, t.medical_notes_updated_at
             FROM tourists t
             WHERE t.user_id = $1`,
            [targetUserId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Tourist not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get medical notes error:', error);
        res.status(500).json({ error: 'Failed to fetch medical notes' });
    }
});

// =====================================================
// PUT /api/users/me/medical-notes
// The tourist updates their own medical notes. Only the tourist themselves
// (or an IT manager acting on their behalf via a different endpoint) may
// write to this field.
// =====================================================
router.put(
    '/me/medical-notes',
    authenticateJWT,
    [body('medical_notes').isString().isLength({ max: 5000 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        try {
            const result = await pool.query(
                `UPDATE tourists
                 SET medical_notes = $1, medical_notes_updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $2
                 RETURNING medical_notes_updated_at`,
                [req.body.medical_notes, req.user.user_id]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'Tourist profile not found' });
            }

            res.json({ success: true, updated_at: result.rows[0].medical_notes_updated_at });
        } catch (error) {
            console.error('Update medical notes error:', error);
            res.status(500).json({ error: 'Failed to update medical notes' });
        }
    }
);

router.delete('/deactivate', authenticateJWT, async (req, res) => {
    const userId = req.user.user_id;

    try {
        if (req.user.is_guest) {
            return res.status(400).json({ error: 'Guest sessions cannot be deactivated this way' });
        }
        const confirmed = req.body?.confirm === true || req.body?.confirm === 'true';
        if (!confirmed) {
            return res.status(400).json({
                error: 'Confirmation required',
                code: 'CONFIRM_REQUIRED',
                message: 'Send { "confirm": true } in the request body'
            });
        }

        const before = await pool.query(
            'SELECT user_id, username, email, is_active FROM users WHERE user_id = $1',
            [userId]
        );
        if (before.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        await refreshTokenService.revokeAllFamiliesForUser(userId, 'account_deactivated');

        await pool.query(
            'UPDATE users SET is_active = false WHERE user_id = $1',
            [userId]
        );

        await audit(req, {
            action: 'user.self_deactivate',
            table_name: 'users',
            record_id: userId,
            old_value: before.rows[0] || null,
            new_value: { ...(before.rows[0] || {}), is_active: false }
        });

        res.json({ success: true, message: 'Account deactivated' });

    } catch (error) {
        console.error('Deactivate account error:', error);
        res.status(500).json({ error: 'Failed to deactivate account' });
    }
});

// =====================================================
// GET /api/users/:id (Admin only)
// Get user by ID
// =====================================================
router.get('/:id', authenticateJWT, authorize('it_manager', 'admin'), async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `SELECT user_id, username, email, phone, first_name, last_name, user_type,
                    is_active, created_at, last_login
             FROM users WHERE user_id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

module.exports = router;