/**
 * User-facing notifications (email + SMS) for account lifecycle events.
 */
const { logger } = require('../utils/logger');
const {
    sendVerificationEmail,
    sendRegistrationWelcomeEmail,
    isEmailConfigured
} = require('./emailService');

function clientAppOrigin() {
    const raw = process.env.CLIENT_URL || process.env.APP_URL || 'http://localhost:3000';
    return String(raw).split(',')[0].trim() || 'http://localhost:3000';
}

function normalizePhoneE164(raw) {
    const cleaned = String(raw || '').trim().replace(/[^\d+]/g, '');
    if (!cleaned) return null;
    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.startsWith('0') && cleaned.length >= 10) {
        return `+256${cleaned.slice(1)}`;
    }
    if (/^[17-9]/.test(cleaned)) {
        return `+256${cleaned}`;
    }
    return `+${cleaned}`;
}

async function sendSmsMessage(phone, body) {
    const to = normalizePhoneE164(phone);
    if (!to) {
        return { sent: false, reason: 'no_phone' };
    }

    const hasTwilio =
        process.env.TWILIO_ACCOUNT_SID
        && process.env.TWILIO_AUTH_TOKEN
        && process.env.TWILIO_FROM_NUMBER;

    if (!hasTwilio) {
        if (process.env.NODE_ENV !== 'production') {
            logger.info(`SMS stub: to=${to} — ${body.slice(0, 120)}`);
        }
        return { sent: false, reason: 'sms_provider_not_configured', to };
    }

    try {
        // eslint-disable-next-line global-require, import/no-extraneous-dependencies
        const twilio = require('twilio');
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({
            body,
            from: process.env.TWILIO_FROM_NUMBER,
            to
        });
        logger.info(`SMS sent to ${to}`);
        return { sent: true, to };
    } catch (err) {
        logger.warn('SMS failed', err.message);
        return { sent: false, reason: err.message, to };
    }
}

/**
 * Password reset link via SMS when email delivery fails or as a backup channel.
 */
async function sendPasswordResetSms(phone, resetUrl, username) {
    const safeName = username || 'SIGTS user';
    const body =
        `Bwindi SIGTS password reset for ${safeName}. Link (15 min): ${resetUrl} ` +
        'If you did not request this, ignore this message.';
    return sendSmsMessage(phone, body);
}

/**
 * After successful signup: verification email, welcome email, optional SMS.
 * Never throws — registration should not fail if notifications fail.
 */
async function notifyUserRegistered({ email, username, phone, userId }) {
    const channels = {
        email: false,
        sms: false,
        verificationEmail: false,
        details: {}
    };

    if (email && userId) {
        try {
            const verification = await sendVerificationEmail(email, userId, clientAppOrigin());
            channels.verificationEmail = Boolean(verification?.sent);
            channels.details.verificationEmail = verification?.reason || (verification?.sent ? 'sent' : 'unknown');
        } catch (err) {
            logger.error('Verification email failed:', err.message);
            channels.details.verificationEmail = err.message;
        }
    }

    if (email) {
        try {
            const welcome = await sendRegistrationWelcomeEmail(email, username, clientAppOrigin());
            channels.email = Boolean(welcome?.sent);
            channels.details.email = welcome?.reason || (welcome?.sent ? 'sent' : 'unknown');
        } catch (err) {
            logger.error('Registration welcome email failed:', err.message);
            channels.details.email = err.message;
        }
    }

    const smsBody =
        `Welcome to Bwindi SIGTS, ${username || 'guest'}! `
        + 'Your account was created. Sign in at the app and check your email to verify your address.';
    const smsResult = await sendSmsMessage(phone, smsBody);
    channels.sms = Boolean(smsResult.sent);
    channels.details.sms = smsResult.reason || (smsResult.sent ? 'sent' : 'unknown');

    if (!channels.email && !channels.sms && !isEmailConfigured()) {
        logger.warn(
            'Registration notifications not delivered: configure SENDGRID_API_KEY + SENDGRID_FROM, SMTP_USER/SMTP_PASS, or Twilio SMS.'
        );
    }

    return channels;
}

module.exports = {
    notifyUserRegistered,
    normalizePhoneE164,
    sendSmsMessage,
    sendPasswordResetSms,
    clientAppOrigin
};
