// backend/src/services/emailService.js
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');
const { resolvePublicAppBaseUrl } = require('../utils/appUrl');

function smtpPassword() {
    return process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '';
}

function smtpFromAddress() {
    return process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@bwindi.local';
}

function sendGridFromAddress() {
    return process.env.SENDGRID_FROM || process.env.SMTP_FROM || smtpFromAddress();
}

function sendGridFromName() {
    return process.env.SENDGRID_FROM_NAME || 'Bwindi SIGTS';
}

function isPlaceholderSecret(value) {
    if (!value) return true;
    const lower = String(value).toLowerCase();
    return [
        'your-',
        'change-in-production',
        'changeme',
        'replace-me',
        'placeholder',
        'your_secure_password',
        'your-app-password',
        'your-email@gmail.com'
    ].some((frag) => lower.includes(frag));
}

function isSendGridConfigured() {
    const key = String(process.env.SENDGRID_API_KEY || '').trim();
    return key.startsWith('SG.') && key.length > 20 && !isPlaceholderSecret(key);
}

function isSmtpConfigured() {
    const pass = smtpPassword();
    const user = String(process.env.SMTP_USER || '').trim();
    return Boolean(user && pass && !isPlaceholderSecret(pass) && !isPlaceholderSecret(user));
}

function isEmailConfigured() {
    return isSendGridConfigured() || isSmtpConfigured();
}

function getEmailProvider() {
    if (isSendGridConfigured()) return 'sendgrid';
    if (isSmtpConfigured()) return 'smtp';
    return 'none';
}

let transporter = null;
let transporterVerified = false;

function getTransporter() {
    if (!isSmtpConfigured()) return null;
    if (!transporter) {
        const port = parseInt(process.env.SMTP_PORT, 10) || 587;
        const explicitSecure = String(process.env.SMTP_SECURE || '').trim().toLowerCase();
        const secure =
            explicitSecure === 'true'
            || (explicitSecure !== 'false' && port === 465);
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port,
            secure,
            auth: {
                user: process.env.SMTP_USER,
                pass: smtpPassword()
            }
        });
    }
    return transporter;
}

async function sendMailViaSendGrid(mailOptions) {
    const fromEmail = sendGridFromAddress();
    const payload = {
        personalizations: [{ to: [{ email: mailOptions.to }] }],
        from: { email: fromEmail, name: sendGridFromName() },
        subject: mailOptions.subject,
        content: [
            {
                type: 'text/html',
                value: mailOptions.html || mailOptions.text || ''
            }
        ]
    };
    if (mailOptions.replyTo) {
        payload.reply_to = { email: mailOptions.replyTo };
    }

    try {
        const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(20000)
        });
        if (res.status >= 200 && res.status < 300) {
            return { sent: true, provider: 'sendgrid' };
        }
        const body = await res.text().catch(() => '');
        logger.warn(`SendGrid mail failed (${res.status}): ${body.slice(0, 300)}`);
        return {
            sent: false,
            reason: `sendgrid_http_${res.status}`,
            provider: 'sendgrid',
            detail: body.slice(0, 200)
        };
    } catch (error) {
        logger.warn(`SendGrid request error: ${error.message}`);
        return {
            sent: false,
            reason: error.message,
            provider: 'sendgrid'
        };
    }
}

async function sendMailViaSmtp(mailOptions) {
    const transport = getTransporter();
    if (!transport) {
        return {
            sent: false,
            reason: 'smtp_not_configured',
            provider: 'smtp'
        };
    }
    if (!transporterVerified) {
        try {
            await transport.verify();
            transporterVerified = true;
        } catch (verifyError) {
            logger.warn(
                `SMTP verify failed (${process.env.SMTP_HOST || 'smtp.gmail.com'}:${process.env.SMTP_PORT || 587}): ${verifyError.message}`
            );
            return {
                sent: false,
                reason: 'smtp_verify_failed',
                provider: 'smtp',
                detail: verifyError.message
            };
        }
    }
    const from = mailOptions.from || `"${sendGridFromName()}" <${smtpFromAddress()}>`;
    try {
        await transport.sendMail({ ...mailOptions, from });
        return { sent: true, provider: 'smtp' };
    } catch (error) {
        logger.warn(`SMTP send failed (${mailOptions.subject} → ${mailOptions.to}): ${error.message}`);
        return {
            sent: false,
            reason: error.message,
            provider: 'smtp'
        };
    }
}

async function sendMail(mailOptions) {
    if (!mailOptions?.to) {
        return { sent: false, reason: 'missing_recipient' };
    }

    if (isSendGridConfigured()) {
        const sg = await sendMailViaSendGrid(mailOptions);
        if (sg.sent) return sg;
        logger.warn(`SendGrid failed (${sg.reason}); trying SMTP fallback if configured.`);
    }

    if (isSmtpConfigured()) {
        return sendMailViaSmtp(mailOptions);
    }

    logger.warn(
        `Email not sent (no provider): ${mailOptions.subject} → ${mailOptions.to}. ` +
        'Set SENDGRID_API_KEY + SENDGRID_FROM (Twilio SendGrid) or SMTP_USER + SMTP_PASS (e.g. Brevo).'
    );
    return {
        sent: false,
        reason: 'email_not_configured',
        provider: 'none'
    };
}

/**
 * Send verification email
 */
async function sendVerificationEmail(email, userId, clientOrigin) {
    const verificationSecret =
        process.env.JWT_EMAIL_VERIFICATION_SECRET
        || process.env.JWT_SECRET
        || 'bwindi-dev-email-verify-secret';
    const verificationToken = jwt.sign(
        { sub: userId, typ: 'email_verify' },
        verificationSecret,
        { expiresIn: '24h' }
    );
    const base = clientOrigin || resolvePublicAppBaseUrl();
    const verificationUrl = `${base}/verify-email?token=${verificationToken}`;

    const result = await sendMail({
        to: email,
        subject: 'Verify Your Email - Bwindi Smart Tour Guide',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2E7D32;">Welcome to Bwindi Tour Guide!</h1>
                <p>Thank you for registering. Please verify your email address to get started.</p>
                <a href="${verificationUrl}" style="background-color: #2E7D32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
                <p>This link expires in 24 hours.</p>
                <hr>
                <p style="color: #666; font-size: 12px;">Bwindi Impenetrable National Park - Smart Information Guide Tour System</p>
            </div>
        `
    });

    if (result.sent) {
        logger.info(`Verification email sent to ${email} via ${result.provider}`);
    }
    return result;
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(email, token, username) {
    const base = resolvePublicAppBaseUrl();
    const resetUrl = `${base}/#reset_password?token=${encodeURIComponent(token)}`;

    const result = await sendMail({
        to: email,
        subject: 'Reset Your Password - Bwindi Smart Tour Guide',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2E7D32;">Password Reset Request</h1>
                <p>Hello ${username || 'there'},</p>
                <p>We received a request to reset your password. Click the link below to create a new password:</p>
                <a href="${resetUrl}" style="background-color: #2E7D32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
                <p>Or copy this link: ${resetUrl}</p>
                <p>This link expires in 15 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
                <hr>
                <p style="color: #666; font-size: 12px;">Bwindi Impenetrable National Park - Smart Information Guide Tour System</p>
            </div>
        `
    });

    if (result.sent) {
        logger.info(`Password reset email sent to ${email} via ${result.provider}`);
    }
    return result;
}

/**
 * Welcome email sent immediately after successful self-service registration.
 */
async function sendRegistrationWelcomeEmail(email, username, clientOrigin) {
    const safeUsername = username || 'there';
    const base = clientOrigin || resolvePublicAppBaseUrl();
    const signInUrl = `${base}/#login`;
    const result = await sendMail({
        to: email,
        subject: 'Your Bwindi SIGTS account is ready',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2E7D32;">Welcome to Bwindi SIGTS</h1>
                <p>Hello ${safeUsername},</p>
                <p>Your visitor account has been created successfully. You can now sign in with the username and password you chose during registration.</p>
                <p><a href="${signInUrl}" style="background-color: #2E7D32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Sign in to SIGTS</a></p>
                <p>If you did not create this account, please contact park IT support immediately.</p>
                <hr>
                <p style="color: #666; font-size: 12px;">Bwindi Impenetrable National Park — Smart Information Guide Tour System</p>
            </div>
        `
    });
    if (result.sent) {
        logger.info(`Registration welcome email sent to ${email} via ${result.provider}`);
    }
    return result;
}

/**
 * Send a generic activity notification email
 */
async function sendActivityNotificationEmail(email, username, activityTitle, activityDetails = '') {
    const safeUsername = username || 'User';
    const safeDetails = activityDetails || 'No additional details were provided.';
    const result = await sendMail({
        to: email,
        subject: `${activityTitle} - Bwindi Smart Tour Guide`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2E7D32;">Activity Notification</h1>
                <p>Hello ${safeUsername},</p>
                <p><strong>${activityTitle}</strong></p>
                <p>${safeDetails}</p>
                <hr>
                <p style="color: #666; font-size: 12px;">Bwindi Impenetrable National Park - Smart Information Guide Tour System</p>
            </div>
        `
    });

    if (result.sent) {
        logger.info(`Activity email sent to ${email} via ${result.provider}: ${activityTitle}`);
    }
    return result;
}

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendRegistrationWelcomeEmail,
    sendActivityNotificationEmail,
    isEmailConfigured,
    isSendGridConfigured,
    isSmtpConfigured,
    getEmailProvider,
    sendMail
};
