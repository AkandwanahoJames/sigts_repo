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

function ensureSecurityConfiguration() {
    const isProd = process.env.NODE_ENV === 'production';
    const secret = process.env.JWT_SECRET || '';
    const isWeakSecret = 
        !secret || 
        secret.includes('bwindi') || 
        secret.includes('secret') || 
        secret.includes('change-in-production') ||
        secret.length < 32;

    if (isProd && REQUIREMENTS.security.enforceJwtSecretInProduction && isWeakSecret) {
        throw new Error(
            'CRITICAL SECURITY ERROR: JWT_SECRET must be explicitly set to a strong, unique value (32+ chars) in production.\n' +
            'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n' +
            'Set in environment: export JWT_SECRET="<generated-secret>"'
        );
    }
}

module.exports = {
    REQUIREMENTS,
    ensureSecurityConfiguration
};
