// backend/src/config/auth.js
// Authentication configuration
// JWT and bcrypt setup for secure user authentication

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./database');
const { logger } = require('../utils/logger');
const { REQUIREMENTS } = require('./requirements');

const JWT_SECRET = process.env.JWT_SECRET || 'bwindi-super-secret-key-change-in-production';
const BCRYPT_ROUNDS = REQUIREMENTS.security.bcryptRounds;

/**
 * Hash a plain text password
 * Why: Never store passwords in plain text!
 * bcrypt adds salt (random data) to each password
 * Same password produces different hashes (prevents rainbow table attacks)
 */
async function hashPassword(plainPassword) {
    if (!plainPassword) {
        throw new Error('Password is required');
    }
    
    try {
        const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
        const hashedPassword = await bcrypt.hash(plainPassword, salt);
        logger.info(`Password hashed successfully (length: ${hashedPassword.length})`);
        return hashedPassword;
    } catch (error) {
        logger.error('Password hashing error:', error);
        throw new Error('Failed to hash password');
    }
}

/**
 * Verify a password against its hash
 * FIXED: Added proper error handling and logging
 */
async function verifyPassword(plainPassword, hashedPassword) {
    // Validate inputs
    if (!plainPassword) {
        logger.error('Password verification failed: No plain password provided');
        return false;
    }
    
    if (!hashedPassword) {
        logger.error('Password verification failed: No hashed password provided');
        return false;
    }
    
    // Check if hash looks like a valid bcrypt hash
    if (!hashedPassword.startsWith('$2')) {
        logger.error(`Password verification failed: Invalid hash format - ${hashedPassword.substring(0, 10)}...`);
        return false;
    }
    
    try {
        const isValid = await bcrypt.compare(plainPassword, hashedPassword);
        logger.info(`Password verification result: ${isValid ? 'SUCCESS' : 'FAILED'}`);
        return isValid;
    } catch (error) {
        logger.error('Password verification error:', error);
        return false;
    }
}

/**
 * Generate JWT token for authenticated user
 * Token contains user_id and user_type for role-based access control
 * Access token TTL is centralized to match system requirements (default 24h).
 */
function generateToken(userId, userType) {
    if (!userId || !userType) {
        throw new Error('userId and userType are required to generate token');
    }
    
    const expiresIn = REQUIREMENTS.security.jwtAccessTtl;
    
    const token = jwt.sign(
        { 
            userId, 
            userType,
            iat: Math.floor(Date.now() / 1000)
        },
        JWT_SECRET,
        { expiresIn }
    );
    
    logger.info(`Token generated for user ${userId} (${userType}), expires in ${expiresIn}`);
    return token;
}

/**
 * Verify and decode JWT token
 */
function verifyToken(token) {
    if (!token) {
        throw new Error('No token provided');
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        logger.info(`Token verified for user ${decoded.userId}`);
        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            logger.warn('Token expired');
            throw new Error('Token expired');
        }
        logger.error('Token verification error:', error.message);
        throw new Error('Invalid token');
    }
}

/**
 * Track failed login attempts
 * Lock account after 5 failed attempts
 */
async function trackFailedLogin(username, ipAddress) {
    if (!username) return;
    
    try {
        // Get user by username
        const result = await pool.query(
            'SELECT user_id, failed_attempts, locked_until FROM users WHERE username = $1',
            [username]
        );
        
        if (result.rows.length === 0) {
            logger.warn(`Failed login attempt for non-existent user: ${username}`);
            return;
        }
        
        const user = result.rows[0];
        const currentAttempts = user.failed_attempts || 0;
        const newAttempts = currentAttempts + 1;
        
        logger.info(`Failed login attempt ${newAttempts}/5 for user ${username}`);
        
        // Lock account after 5 failed attempts
        if (newAttempts >= 5) {
            await pool.query(
                `UPDATE users 
                 SET failed_attempts = $1, 
                     locked_until = NOW() + INTERVAL '15 minutes'
                 WHERE user_id = $2`,
                [newAttempts, user.user_id]
            );
            logger.warn(`Account ${username} locked for 15 minutes due to 5 failed attempts`);
        } else {
            await pool.query(
                'UPDATE users SET failed_attempts = $1 WHERE user_id = $2',
                [newAttempts, user.user_id]
            );
        }
        
        // Log attempt to audit_logs (handle if table exists)
        try {
            await pool.query(
                `INSERT INTO audit_logs (user_id, action, ip_address, created_at)
                 VALUES ($1, 'failed_login', $2, NOW())`,
                [user.user_id, ipAddress || 'unknown']
            );
        } catch (auditError) {
            // Audit table might not exist yet, just log
            logger.warn('Could not log to audit_logs:', auditError.message);
        }
        
    } catch (error) {
        logger.error('Failed to track login attempt:', error);
    }
}

/**
 * Reset failed attempts after successful login
 */
async function resetFailedAttempts(userId) {
    if (!userId) return;
    
    try {
        const result = await pool.query(
            'UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE user_id = $1 RETURNING user_id',
            [userId]
        );
        
        if (result.rows.length > 0) {
            logger.info(`Reset failed attempts for user ${userId}`);
        }
    } catch (error) {
        logger.error('Failed to reset attempts:', error);
    }
}

/**
 * Create a test user for debugging
 * WARNING: Only use in development!
 */
async function createTestUser() {
    if (process.env.NODE_ENV === 'production') {
        logger.warn('createTestUser called in production - skipping');
        return;
    }
    
    try {
        const testPassword = 'test123';
        const hashedPassword = await hashPassword(testPassword);
        
        // Check whether the user already exists
        const existing = await pool.query(
            'SELECT user_id FROM users WHERE username = $1',
            ['testuser']
        );
        
        if (existing.rows.length === 0) {
            await pool.query(
                `INSERT INTO users (user_id, username, password_hash, email, user_type, is_active)
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, true)`,
                ['testuser', hashedPassword, 'test@bwindi.com', 'tourist']
            );
            logger.info(`Test user created: username='testuser', password='${testPassword}'`);
            logger.info(`Password hash: ${hashedPassword}`);
        } else {
            logger.info('Test user already exists');
        }
    } catch (error) {
        logger.error('Failed to create test user:', error);
    }
}

// Export all functions
module.exports = {
    hashPassword,
    verifyPassword,
    generateToken,
    verifyToken,
    trackFailedLogin,
    resetFailedAttempts,
    createTestUser
};