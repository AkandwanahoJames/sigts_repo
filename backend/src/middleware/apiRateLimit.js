/**
 * API rate limiting tuned for SIGTS dashboards (periodic refresh + presence heartbeats).
 * Avoids flagging normal signed-in use as "Too many requests".
 */
const rateLimit = require('express-rate-limit');
const { REQUIREMENTS } = require('../config/requirements');

/** Paths under /api that are high-frequency and safe to exclude from the general cap. */
const SKIP_PATH_PREFIXES = [
    '/health',
    '/auth/presence',
    '/auth/refresh',
    '/auth/login',
    '/auth/login-direct',
    '/auth/register',
    '/auth/guest',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/animals',
    '/locations/public',
    '/routes/public',
    '/weather',
    '/faqs',
    '/catalog-meta',
    '/staying-safe-guide',
    '/tourist-biodiversity',
];

function isRateLimitDisabled() {
    if (/^1|true|yes$/i.test(String(process.env.DISABLE_API_RATE_LIMIT || '').trim())) {
        return true;
    }
    return process.env.NODE_ENV !== 'production';
}

function normalizeApiPath(req) {
    const raw = req.originalUrl || req.url || '';
    const pathOnly = raw.split('?')[0];
    if (pathOnly.startsWith('/api')) {
        return pathOnly.slice(4) || '/';
    }
    return pathOnly;
}

function shouldSkipGeneralRateLimit(req) {
    const path = normalizeApiPath(req);
    if (SKIP_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
        return true;
    }
    if (req.method === 'GET' && /^\/(animals|wildlife-tour-themes|cultural)(\/|$)/.test(path)) {
        return true;
    }
    return false;
}

function createGeneralApiLimiter() {
    if (isRateLimitDisabled()) {
        return (_req, _res, next) => next();
    }

    const windowMs = REQUIREMENTS.performance.generalRateLimitWindowMs;
    const max = REQUIREMENTS.performance.generalRateLimitMax;

    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        skip: shouldSkipGeneralRateLimit,
        message: {
            success: false,
            error: 'Too many requests',
            message:
                'You are sending requests faster than the server allows. Wait a moment and try again.',
            retryAfterSeconds: Math.ceil(windowMs / 1000),
        },
        handler: (req, res, next, options) => {
            res.status(options.statusCode).json(options.message);
        },
    });
}

function createAuthLoginLimiter() {
    return rateLimit({
        windowMs: REQUIREMENTS.performance.authRateLimitWindowMs,
        max: REQUIREMENTS.performance.authRateLimitMax,
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        message: {
            success: false,
            error: 'Too many authentication attempts',
            message: 'Please try again later.',
        },
    });
}

module.exports = {
    createGeneralApiLimiter,
    createAuthLoginLimiter,
    shouldSkipGeneralRateLimit,
    normalizeApiPath,
    isRateLimitDisabled,
};
