/**
 * In-app notifications (PostgreSQL `notifications` table — §4.4.3 tourist alerts).
 */
const { pool } = require('../config/database');

async function createInAppNotification(userId, { type = 'system', title, message, data = null, expiresAt = null }) {
    if (!userId || !title || !message) return null;
    try {
        const result = await pool.query(
            `INSERT INTO notifications (user_id, type, title, message, data, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING notification_id, type, title, message, data, is_read, created_at`,
            [userId, type, String(title).slice(0, 200), String(message).slice(0, 4000), data, expiresAt]
        );
        return result.rows[0] || null;
    } catch (err) {
        console.warn('createInAppNotification failed:', err.message);
        return null;
    }
}

async function notifyFeedbackResponse(feedbackId, responseText) {
    try {
        const row = await pool.query(
            `SELECT f.feedback_id, t.user_id
             FROM feedback f
             JOIN tourists t ON t.tourist_id = f.tourist_id
             WHERE f.feedback_id = $1`,
            [feedbackId]
        );
        const userId = row.rows[0]?.user_id;
        if (!userId) return;
        await createInAppNotification(userId, {
            type: 'system',
            title: 'SIGTS replied to your feedback',
            message: String(responseText).slice(0, 500),
            data: { feedback_id: feedbackId, link_view: 'profile' }
        });
    } catch (err) {
        console.warn('notifyFeedbackResponse failed:', err.message);
    }
}

async function notifyProximityAlert(userId, locationName, distanceMeters) {
    if (!userId) return;
    await createInAppNotification(userId, {
        type: 'sighting_alert',
        title: `Near ${locationName || 'a point of interest'}`,
        message: `You are about ${Math.round(distanceMeters)} m away. Open the map for guidance.`,
        data: { link_view: 'map', location_name: locationName }
    });
}

module.exports = {
    createInAppNotification,
    notifyFeedbackResponse,
    notifyProximityAlert
};
