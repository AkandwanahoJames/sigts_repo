// Centralized requirement-driven runtime settings for SIGTS.
// These values mirror project non-functional requirements and can be tuned by env vars.

const REQUIREMENTS = {
    security: {
        jwtAccessTtl: process.env.JWT_ACCESS_TTL || '24h',
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
        enforceJwtSecretInProduction: true
    },
    performance: {
        apiRequestBodyLimit: process.env.API_BODY_LIMIT || '10mb',
        generalRateLimitWindowMs: parseInt(process.env.GENERAL_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10),
        generalRateLimitMax: parseInt(process.env.GENERAL_RATE_LIMIT_MAX || '200', 10),
        authRateLimitWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || `${15 * 60 * 1000}`, 10),
        authRateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10)
    },
    compatibility: {
        supportedLanguages: (process.env.SUPPORTED_LANGUAGES || 'en,fr,local').split(',').map((v) => v.trim())
    }
};

// Boot-time environment validation. Refuses to start if required env vars
// are missing or clearly invalid.
function ensureSecurityConfiguration() {
    const isProd = process.env.NODE_ENV === 'production';
    const errors = [];
    const warnings = [];

    const placeholderFragments = [
        'your-',
        'change-in-production',
        'change_in_production',
        'changeme',
        'replace-me',
        'placeholder'
    ];

    const isPlaceholder = (value) => {
        if (!value) return true;
        const lower = value.toLowerCase();
        return placeholderFragments.some((frag) => lower.includes(frag));
    };

    // JWT secret
    const secret = process.env.JWT_SECRET || '';
    const isWeakSecret =
        !secret ||
        isPlaceholder(secret) ||
        secret.includes('bwindi') ||
        secret.includes('secret') ||
        secret.length < 32;
    if (isProd && REQUIREMENTS.security.enforceJwtSecretInProduction && isWeakSecret) {
        errors.push(
            'JWT_SECRET must be a strong, unique value (32+ chars) in production. ' +
            'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
    } else if (isWeakSecret) {
        warnings.push('JWT_SECRET is weak or missing — fine for dev, must be replaced before production.');
    }

    // Database
    if (!process.env.DB_HOST) errors.push('DB_HOST is required');
    if (!process.env.DB_NAME) errors.push('DB_NAME is required');
    if (!process.env.DB_USER) errors.push('DB_USER is required');
    if (isProd && (!process.env.DB_PASSWORD || isPlaceholder(process.env.DB_PASSWORD))) {
        errors.push('DB_PASSWORD must be set to a real value in production');
    }

    // Client URL
    if (isProd && !process.env.CLIENT_URL) {
        warnings.push('CLIENT_URL is not set; CORS will fall back to defaults.');
    }

    if (errors.length > 0) {
        throw new Error(
            'CONFIGURATION ERROR — refusing to start:\n  - ' + errors.join('\n  - ')
        );
    }

    if (warnings.length > 0) {
        // Use console here because the structured logger may not be ready yet.
        warnings.forEach((w) => console.warn(`[config] WARNING: ${w}`));
    }
}

module.exports = {
    REQUIREMENTS,
    ensureSecurityConfiguration
};
