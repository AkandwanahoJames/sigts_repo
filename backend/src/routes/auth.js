// backend/src/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { REQUIREMENTS } = require('../config/requirements');
const { logger } = require('../utils/logger');

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

// =====================================================
// POST /api/auth/register
// =====================================================
router.post('/register', [
    body('username').isLength({ min: 3 }).trim(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 4 }),
    body('userType').optional().isIn(['tourist', 'guide', 'it_manager'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password, firstName, lastName, userType } = req.body;

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
            `INSERT INTO users (user_id, username, password_hash, email, first_name, last_name, user_type, is_active)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, true)
             RETURNING user_id, username, email, user_type`,
            [username, hashedPassword, email, firstName || '', lastName || '', userType || 'tourist']
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
    body('password').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    try {
        const result = await pool.query(
            `SELECT user_id, username, password_hash, user_type, first_name, last_name, is_active
             FROM users WHERE username = $1 OR email = $1`,
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(401).json({ error: 'Account deactivated' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.user_id, userType: user.user_type },
            JWT_SECRET,
            { expiresIn: REQUIREMENTS.security.jwtAccessTtl }
        );

        res.json({
            success: true,
            token,
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

module.exports = router;
