/**
 * Canonical username/email rules — shared by register, login, and admin user APIs.
 * Avoids false positives (Gmail dot folding) and false negatives (case drift).
 */

function normalizeUsername(raw) {
    return String(raw || '').trim().toLowerCase();
}

const validator = require('validator');

/**
 * Canonical email for storage and duplicate checks.
 * Gmail/googlemail: dot-insensitive + subaddress folding (consistent with major providers).
 * Other domains: trim + lowercase only (no false dot-collisions on outlook.com etc.).
 */
function normalizeEmail(raw) {
    const base = String(raw || '').trim().toLowerCase();
    if (!base) return '';
    if (/@(gmail|googlemail)\.com$/.test(base)) {
        const folded = validator.normalizeEmail(base, {
            gmail_remove_dots: true,
            gmail_remove_subaddress: true
        });
        return folded || base;
    }
    return base;
}

function isValidEmailShape(raw) {
    const email = normalizeEmail(raw);
    if (!email || email.length > 254) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Find conflicts for registration. Returns { username, email } with row or null.
 */
async function findRegistrationConflicts(db, usernameRaw, emailRaw) {
    const username = normalizeUsername(usernameRaw);
    const email = normalizeEmail(emailRaw);

    const usernameRow = await db.query(
        `SELECT user_id, username, email, is_active
         FROM users
         WHERE LOWER(TRIM(username)) = $1
         LIMIT 1`,
        [username]
    );

    const emailRow = await db.query(
        `SELECT user_id, username, email, is_active
         FROM users
         WHERE LOWER(TRIM(email)) = $1
            OR (
                $1 ~ '@(gmail|googlemail)\\.com$'
                AND LOWER(TRIM(email)) ~ '@(gmail|googlemail)\\.com$'
                AND LOWER(REPLACE(SPLIT_PART(TRIM(email), '@', 1), '.', ''))
                    = LOWER(REPLACE(SPLIT_PART($1, '@', 1), '.', ''))
                AND SPLIT_PART(LOWER(TRIM(email)), '@', 2) = SPLIT_PART($1, '@', 2)
            )
         LIMIT 1`,
        [email]
    );

    return {
        username: usernameRow.rows[0] || null,
        email: emailRow.rows[0] || null,
        normalized: { username, email }
    };
}

/**
 * Resolve login identifier: prefer username match, then email (avoids OR ambiguity).
 */
async function findUserForLogin(db, identifierRaw) {
    const identifier = String(identifierRaw || '').trim();
    if (!identifier) return null;

    const byUsername = await db.query(
        `SELECT user_id, username, password_hash, user_type, first_name, last_name, is_active, email
         FROM users
         WHERE LOWER(TRIM(username)) = LOWER(TRIM($1))
         LIMIT 1`,
        [identifier]
    );
    if (byUsername.rows.length > 0) {
        return { user: byUsername.rows[0], matchedBy: 'username' };
    }

    const byEmail = await db.query(
        `SELECT user_id, username, password_hash, user_type, first_name, last_name, is_active, email
         FROM users
         WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
         LIMIT 1`,
        [identifier]
    );
    if (byEmail.rows.length > 0) {
        return { user: byEmail.rows[0], matchedBy: 'email' };
    }

    return null;
}

function registrationConflictResponse(conflicts) {
    const { username: uRow, email: eRow } = conflicts;

    if (uRow && eRow && uRow.user_id === eRow.user_id) {
        const inactive = uRow.is_active === false;
        return {
            status: 409,
            body: {
                error: inactive
                    ? 'An inactive account already uses this username and email. Contact support to reactivate it.'
                    : 'This username and email are already registered. Try signing in instead.',
                code: inactive ? 'ACCOUNT_INACTIVE' : 'CREDENTIALS_TAKEN',
                field: 'username',
                conflict: { username: true, email: true, inactive }
            }
        };
    }

    if (uRow) {
        const inactive = uRow.is_active === false;
        return {
            status: 409,
            body: {
                error: inactive
                    ? `Username "${uRow.username}" belongs to an inactive account. Choose another username or contact support.`
                    : `Username "${uRow.username}" is already taken. Sign in or choose a different username.`,
                code: inactive ? 'USERNAME_INACTIVE' : 'USERNAME_TAKEN',
                field: 'username',
                conflict: { username: true, email: false, inactive }
            }
        };
    }

    if (eRow) {
        const inactive = eRow.is_active === false;
        return {
            status: 409,
            body: {
                error: inactive
                    ? 'This email belongs to an inactive account. Contact support to reactivate it or use another email.'
                    : 'This email is already registered. Sign in or use a different email address.',
                code: inactive ? 'EMAIL_INACTIVE' : 'EMAIL_TAKEN',
                field: 'email',
                conflict: { username: false, email: true, inactive }
            }
        };
    }

    return null;
}

function mapUniqueViolation(error) {
    if (error?.code !== '23505') return null;
    const constraint = String(error.constraint || '').toLowerCase();
    const detail = String(error.detail || '').toLowerCase();
    if (constraint.includes('username') || detail.includes('username')) {
        return {
            status: 409,
            body: {
                error: 'Username is already taken.',
                code: 'USERNAME_TAKEN',
                field: 'username'
            }
        };
    }
    if (constraint.includes('email') || detail.includes('email')) {
        return {
            status: 409,
            body: {
                error: 'Email is already registered.',
                code: 'EMAIL_TAKEN',
                field: 'email'
            }
        };
    }
    return {
        status: 409,
        body: {
            error: 'Username or email already exists.',
            code: 'CREDENTIALS_TAKEN',
            field: 'username'
        }
    };
}

module.exports = {
    normalizeUsername,
    normalizeEmail,
    isValidEmailShape,
    findRegistrationConflicts,
    findUserForLogin,
    registrationConflictResponse,
    mapUniqueViolation
};
