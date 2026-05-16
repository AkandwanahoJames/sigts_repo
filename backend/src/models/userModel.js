// backend/src/models/userModel.js
const { pool } = require('../config/database');

/**
 * User model for database operations
 */
class UserModel {
    /**
     * Find user by ID
     */
    static async findById(userId) {
        const result = await pool.query(
            `SELECT user_id, username, email, phone, first_name, last_name, 
                    user_type, created_at, last_login, is_active, language_pref, profile_pic_url
             FROM users WHERE user_id = $1`,
            [userId]
        );
        return result.rows[0] || null;
    }

    /**
     * Find user by username or email
     */
    static async findByUsernameOrEmail(username, email) {
        const { normalizeUsername, normalizeEmail } = require('../utils/userIdentity');
        const result = await pool.query(
            `SELECT user_id, username, email, password_hash, user_type, is_active
             FROM users
             WHERE LOWER(TRIM(username)) = $1 OR LOWER(TRIM(email)) = $2
             LIMIT 1`,
            [normalizeUsername(username), normalizeEmail(email)]
        );
        return result.rows[0] || null;
    }

    /**
     * Create new user
     */
    static async create(userData) {
        const { username, email, passwordHash, firstName, lastName, phone, userType } = userData;
        
        const result = await pool.query(
            `INSERT INTO users (user_id, username, password_hash, email, first_name, last_name, phone, user_type)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
             RETURNING user_id, username, email, user_type`,
            [username, passwordHash, email, firstName, lastName, phone, userType]
        );
        
        return result.rows[0];
    }

    /**
     * Update user
     */
    static async update(userId, updates) {
        const allowedFields = ['first_name', 'last_name', 'phone', 'language_pref', 'profile_pic_url'];
        const setClauses = [];
        const values = [];
        let paramIndex = 1;

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                setClauses.push(`${field} = $${paramIndex++}`);
                values.push(updates[field]);
            }
        }

        if (setClauses.length === 0) return null;

        values.push(userId);
        const result = await pool.query(
            `UPDATE users SET ${setClauses.join(', ')} WHERE user_id = $${paramIndex}
             RETURNING user_id, username, email, first_name, last_name, phone, language_pref, profile_pic_url`,
            values
        );
        
        return result.rows[0] || null;
    }

    /**
     * Deactivate user
     */
    static async deactivate(userId) {
        await pool.query(
            'UPDATE users SET is_active = false WHERE user_id = $1',
            [userId]
        );
        return true;
    }
}

module.exports = UserModel;