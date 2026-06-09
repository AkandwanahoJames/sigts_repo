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

function isPlaceholderSecret(value) {
    if (!value) return true;
    const lower = String(value).toLowerCase();
    return [
        'your-',
        'change-in-production',
        'changeme',
        'replace-me',
        'placeholder',
        'your_secure_password'
    ].some((frag) => lower.includes(frag));
}

function isEmailConfigured() {
    const pass = smtpPassword();
    return Boolean(process.env.SMTP_USER && pass && !isPlaceholderSecret(pass));
}

let transporter = null;
let transporterVerified = false;

function getTransporter() {
    if (!isEmailConfigured()) return null;
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

async function sendMail(mailOptions) {
    const transport = getTransporter();
    if (!transport) {
        logger.warn(
            `Email not sent (SMTP not configured): ${mailOptions.subject} → ${mailOptions.to}`
        );
        return {
            sent: false,
            reason: 'smtp_not_configured'
        };
    }
    if (!transporterVerified) {
        try {
            await transport.verify();
            transporterVerified = true;
        } catch (verifyError) {
            logger.warn(`SMTP verify failed (${process.env.SMTP_HOST || 'smtp.gmail.com'}:${process.env.SMTP_PORT || 587}): ${verifyError.message}`);
            return {
                sent: false,
                reason: 'smtp_verify_failed'
            };
        }
    }
    const from = mailOptions.from || `"Bwindi SIGTS" <${smtpFromAddress()}>`;
    try {
        await transport.sendMail({ ...mailOptions, from });
        return {
            sent: true
        };
    } catch (error) {
        logger.warn(`Email not sent (${mailOptions.subject} → ${mailOptions.to}): ${error.message}`);
        return {
            sent: false,
            reason: error.message
        };
    }
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
        logger.info(`Verification email sent to ${email}`);
    }
    return result;
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(email, token, username) {
    const base = resolvePublicAppBaseUrl();
    const resetUrl = `${base}/reset-password?token=${token}`;

    const result = await sendMail({
        to: email,
        subject: 'Reset Your Password - Bwindi Smart Tour Guide',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2E7D32;">Password Reset Request</h1>
                <p>Hello ${username},</p>
                <p>We received a request to reset your password. Click the link below to create a new password:</p>
                <a href="${resetUrl}" style="background-color: #2E7D32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
                <p>This link expires in 15 minutes.</p>
                <p>If you didn't request this, please ignore this email.</p>
                <hr>
                <p style="color: #666; font-size: 12px;">Bwindi Impenetrable National Park - Smart Information Guide Tour System</p>
            </div>
        `
    });

    if (result.sent) {
        logger.info(`Password reset email sent to ${email}`);
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
        logger.info(`Registration welcome email sent to ${email}`);
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
        logger.info(`Activity email sent to ${email}: ${activityTitle}`);
    }
    return result;
}

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendRegistrationWelcomeEmail,
    sendActivityNotificationEmail,
    isEmailConfigured
};
