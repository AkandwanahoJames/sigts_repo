// Refresh-token rotation service.
//
// Each successful login creates a new "family". Each refresh creates a new
// token in the same family AND marks the previous one as rotated. If a
// previously-rotated token is presented again, the entire family is revoked
// (treated as a stolen-token replay).

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { logger } = require('../utils/logger');

const REFRESH_JWT_SECRET =
    process.env.JWT_REFRESH_SECRET ||
    `${process.env.JWT_SECRET || 'bwindi-dev-key-change-in-production'}-refresh`;
const REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TTL || '7d';

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function ttlToExpiresAt(ttl) {
    // Accept "7d", "30d", "12h", "3600s", or seconds-as-number string.
    const match = String(ttl).match(/^(\d+)([smhd])$/);
    if (!match) {
        const seconds = Number(ttl);
        if (Number.isFinite(seconds) && seconds > 0) {
            return new Date(Date.now() + seconds * 1000);
        }
        // Fallback: 7 days.
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return new Date(Date.now() + value * multipliers[unit]);
}

function signRefresh(userId, userType) {
    // jti makes every issued token unique even when issued in the same second
    // for the same user, preventing token_hash UNIQUE constraint collisions.
    return jwt.sign(
        { userId, userType, typ: 'refresh', jti: crypto.randomUUID() },
        REFRESH_JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_TTL }
    );
}

// Issue a brand-new family + first token. Returns { token, familyId, tokenId }.
async function issueNewFamily(userId, userType, { ip, userAgent } = {}) {
    const familyResult = await pool.query(
        `INSERT INTO refresh_token_families (user_id)
         VALUES ($1) RETURNING family_id`,
        [userId]
    );
    const familyId = familyResult.rows[0].family_id;

    const token = signRefresh(userId, userType);
    const tokenHash = hashToken(token);
    const expiresAt = ttlToExpiresAt(REFRESH_TOKEN_TTL);

    const tokenResult = await pool.query(
        `INSERT INTO refresh_tokens
            (family_id, token_hash, expires_at, user_agent, ip_address)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING token_id`,
        [familyId, tokenHash, expiresAt, userAgent || null, ip || null]
    );

    return { token, familyId, tokenId: tokenResult.rows[0].token_id };
}

// Rotate a presented refresh token. Returns { token, familyId } on success or
// throws an Error with a `.code` property on failure.
async function rotateToken(presentedToken, { ip, userAgent } = {}) {
    let payload;
    try {
        payload = jwt.verify(presentedToken, REFRESH_JWT_SECRET);
    } catch (error) {
        const err = new Error('Invalid refresh token');
        err.code = 'INVALID_SIGNATURE';
        throw err;
    }

    if (payload.typ !== 'refresh') {
        const err = new Error('Not a refresh token');
        err.code = 'WRONG_TOKEN_TYPE';
        throw err;
    }

    const tokenHash = hashToken(presentedToken);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const lookup = await client.query(
            `SELECT t.token_id, t.family_id, t.rotated_at, t.expires_at,
                    f.revoked_at AS family_revoked_at, f.user_id
             FROM refresh_tokens t
             JOIN refresh_token_families f ON f.family_id = t.family_id
             WHERE t.token_hash = $1
             FOR UPDATE`,
            [tokenHash]
        );

        if (lookup.rows.length === 0) {
            await client.query('ROLLBACK');
            const err = new Error('Refresh token unknown');
            err.code = 'UNKNOWN_TOKEN';
            throw err;
        }

        const row = lookup.rows[0];

        if (row.family_revoked_at) {
            await client.query('ROLLBACK');
            const err = new Error('Refresh token family revoked');
            err.code = 'FAMILY_REVOKED';
            throw err;
        }

        if (new Date(row.expires_at).getTime() < Date.now()) {
            await client.query('ROLLBACK');
            const err = new Error('Refresh token expired');
            err.code = 'EXPIRED';
            throw err;
        }

        // Reuse detection: a token already marked rotated must NEVER be
        // accepted again. Revoke the entire family.
        if (row.rotated_at) {
            await client.query(
                `UPDATE refresh_token_families
                 SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = 'reuse_detected'
                 WHERE family_id = $1`,
                [row.family_id]
            );
            await client.query('COMMIT');
            logger.warn('Refresh token reuse detected — family revoked', {
                family_id: row.family_id,
                user_id: row.user_id
            });
            const err = new Error('Refresh token reuse detected');
            err.code = 'REUSE_DETECTED';
            throw err;
        }

        // Issue new token in same family.
        const newToken = signRefresh(payload.userId, payload.userType);
        const newHash = hashToken(newToken);
        const newExpiresAt = ttlToExpiresAt(REFRESH_TOKEN_TTL);

        const newRow = await client.query(
            `INSERT INTO refresh_tokens
                (family_id, token_hash, expires_at, user_agent, ip_address)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING token_id`,
            [row.family_id, newHash, newExpiresAt, userAgent || null, ip || null]
        );

        await client.query(
            `UPDATE refresh_tokens
             SET rotated_at = CURRENT_TIMESTAMP, rotated_to = $1
             WHERE token_id = $2`,
            [newRow.rows[0].token_id, row.token_id]
        );

        await client.query('COMMIT');
        return { token: newToken, familyId: row.family_id };
    } catch (error) {
        try { await client.query('ROLLBACK'); } catch (_) {}
        throw error;
    } finally {
        client.release();
    }
}

async function revokeFamily(familyId, reason = 'manual_revoke') {
    await pool.query(
        `UPDATE refresh_token_families
         SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = $2
         WHERE family_id = $1 AND revoked_at IS NULL`,
        [familyId, reason]
    );
}

async function revokeAllFamiliesForUser(userId, reason = 'logout_all') {
    await pool.query(
        `UPDATE refresh_token_families
         SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = $2
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId, reason]
    );
}

module.exports = {
    issueNewFamily,
    rotateToken,
    revokeFamily,
    revokeAllFamiliesForUser
};
