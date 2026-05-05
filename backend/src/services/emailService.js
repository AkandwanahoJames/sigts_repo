// backend/src/services/emailService.js
const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

// Create transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

/**
 * Send verification email
 */
async function sendVerificationEmail(email, userId) {
    const verificationToken = Buffer.from(`${userId}:${Date.now()}`).toString('base64');
    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${verificationToken}`;

    const mailOptions = {
        from: `"Bwindi Tour Guide" <${process.env.SMTP_USER}>`,
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
    };

    try {
        await transporter.sendMail(mailOptions);
        logger.info(`Verification email sent to ${email}`);
    } catch (error) {
        logger.error(`Failed to send verification email to ${email}:`, error);
    }
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(email, token, username) {
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

    const mailOptions = {
        from: `"Bwindi Tour Guide" <${process.env.SMTP_USER}>`,
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
    };

    try {
        await transporter.sendMail(mailOptions);
        logger.info(`Password reset email sent to ${email}`);
    } catch (error) {
        logger.error(`Failed to send password reset email to ${email}:`, error);
    }
}

/**
 * Send a generic activity notification email
 */
async function sendActivityNotificationEmail(email, username, activityTitle, activityDetails = '') {
    const safeUsername = username || 'User';
    const safeDetails = activityDetails || 'No additional details were provided.';
    const mailOptions = {
        from: `"Bwindi Tour Guide" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `${activityTitle} - Bwindi Smart Tour Guide`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #2E7D32;">Activity Notification</h1>
                <p>Hello ${safeUsername},</p>
                <p>${activityTitle}</p>
                <p>${safeDetails}</p>
                <hr>
                <p style="color: #666; font-size: 12px;">Bwindi Impenetrable National Park - Smart Information Guide Tour System</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        logger.info(`Activity email sent to ${email}: ${activityTitle}`);
    } catch (error) {
        logger.error(`Failed to send activity email to ${email}:`, error);
    }
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendActivityNotificationEmail };