// backend/src/services/emailService.js
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');

function smtpPassword() {
    return process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '';
}

function smtpFromAddress() {
    return process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@bwindi.local';
}

function isEmailConfigured() {
    return Boolean(process.env.SMTP_USER && smtpPassword());
}

let transporter = null;

function getTransporter() {
    if (!isEmailConfigured()) return null;
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT, 10) || 587,
            secure: false,
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
        return false;
    }
    const from = mailOptions.from || `"Bwindi SIGTS" <${smtpFromAddress()}>`;
    await transport.sendMail({ ...mailOptions, from });
    return true;
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
    const base = (clientOrigin || process.env.CLIENT_URL || 'http://localhost:3000')
        .split(',')[0]
        .trim()
        .replace(/\/$/, '');
    const verificationUrl = `${base}/verify-email?token=${verificationToken}`;

    const sent = await sendMail({
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

    if (sent) {
        logger.info(`Verification email sent to ${email}`);
    }
    return sent;
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(email, token, username) {
    const base = (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');
    const resetUrl = `${base}/reset-password?token=${token}`;

    const sent = await sendMail({
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

    if (sent) {
        logger.info(`Password reset email sent to ${email}`);
    }
    return sent;
}

/**
 * Send a generic activity notification email
 */
async function sendActivityNotificationEmail(email, username, activityTitle, activityDetails = '') {
    const safeUsername = username || 'User';
    const safeDetails = activityDetails || 'No additional details were provided.';
    const sent = await sendMail({
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

    if (sent) {
        logger.info(`Activity email sent to ${email}: ${activityTitle}`);
    }
    return sent;
}

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendActivityNotificationEmail,
    isEmailConfigured
};
