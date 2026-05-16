/**
 * User-facing notifications (email + SMS) for account lifecycle events.
 */
const { logger } = require('../utils/logger');
const {
    sendVerificationEmail,
    sendActivityNotificationEmail,
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
            logger.info(`SMS stub (registration): to=${to} — ${body.slice(0, 120)}`);
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
        logger.info(`Registration SMS sent to ${to}`);
        return { sent: true, to };
    } catch (err) {
        logger.warn('Registration SMS failed', err.message);
        return { sent: false, reason: err.message, to };
    }
}

/**
 * After successful signup: verification email, welcome email, optional SMS.
 * Never throws — registration should not fail if notifications fail.
 */
async function notifyUserRegistered({ email, username, phone, userId }) {
    const channels = { email: false, sms: false, verificationEmail: false };

    if (email && userId) {
        try {
            channels.verificationEmail = await sendVerificationEmail(email, userId, clientAppOrigin());
        } catch (err) {
            logger.error('Verification email failed:', err.message);
        }
    }

    if (email) {
        try {
            channels.email = await sendActivityNotificationEmail(
                email,
                username,
                'Welcome to Bwindi SIGTS — account created',
                'Your account has been registered successfully. You can sign in with your username and password. '
                    + 'If you did not create this account, contact park support immediately.'
            );
        } catch (err) {
            logger.error('Registration welcome email failed:', err.message);
        }
    }

    const smsBody =
        `Welcome to Bwindi SIGTS, ${username || 'guest'}! `
        + 'Your account was created. Sign in at the app and check your email to verify your address.';
    const smsResult = await sendSmsMessage(phone, smsBody);
    channels.sms = Boolean(smsResult.sent);

    if (!channels.email && !channels.sms && !isEmailConfigured()) {
        logger.warn(
            'Registration notifications not delivered: configure SMTP_USER/SMTP_PASS or Twilio for email/SMS.'
        );
    }

    return channels;
}

module.exports = {
    notifyUserRegistered,
    normalizePhoneE164,
    sendSmsMessage,
    clientAppOrigin
};
