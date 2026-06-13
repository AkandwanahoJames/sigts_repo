/**
 * In-app notifications (PostgreSQL `notifications` table — §4.4.3 tourist alerts).
 */
const { pool } = require('../config/database');
const { sendActivityNotificationEmail } = require('./emailService');
const { logger } = require('../utils/logger');

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
            `SELECT f.feedback_id, t.user_id, u.email, u.username
             FROM feedback f
             JOIN tourists t ON t.tourist_id = f.tourist_id
             JOIN users u ON u.user_id = t.user_id
             WHERE f.feedback_id = $1`,
            [feedbackId]
        );
        const { user_id: userId, email, username } = row.rows[0] || {};
        if (!userId) return;

        const preview = String(responseText).slice(0, 500);
        await createInAppNotification(userId, {
            type: 'system',
            title: 'SIGTS replied to your feedback',
            message: preview,
            data: { feedback_id: feedbackId, link_view: 'profile' }
        });

        if (email) {
            sendActivityNotificationEmail(
                email,
                username,
                'SIGTS replied to your feedback',
                preview
            ).catch((err) => logger.warn('Feedback response email failed:', err.message));
        }
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

async function listItStaffUserIds() {
    try {
        const result = await pool.query(
            `SELECT DISTINCT u.user_id
             FROM users u
             LEFT JOIN it_managers im ON im.user_id = u.user_id
             WHERE u.is_active = true
               AND (u.user_type IN ('it_manager', 'admin') OR im.user_id IS NOT NULL)`
        );
        return result.rows.map((r) => r.user_id).filter(Boolean);
    } catch (err) {
        logger.warn('listItStaffUserIds failed:', err.message);
        return [];
    }
}

function formatClockTime(isoOrDate) {
    if (!isoOrDate) return 'now';
    try {
        return new Date(isoOrDate).toLocaleString('en-UG', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch (_) {
        return 'now';
    }
}

/**
 * Guide clock-in: confirm to the guide and alert IT operations staff (in-app bell).
 */
async function notifyGuideShiftClockIn({ guideUserId, guideName, shiftId, actualStart }) {
    if (!guideUserId) return { guide: false, it_staff: 0 };

    const at = formatClockTime(actualStart);
    const name = guideName || 'A guide';

    const guideNote = await createInAppNotification(guideUserId, {
        type: 'system',
        title: 'You are clocked in',
        message: `Your park shift is active as of ${at}. You are visible to IT operations as on duty.`,
        data: { link_view: 'guide_dashboard', shift_id: shiftId, event: 'guide_clock_in' }
    });

    const itUserIds = await listItStaffUserIds();
    let itCount = 0;
    for (const itUserId of itUserIds) {
        if (itUserId === guideUserId) continue;
        const sent = await createInAppNotification(itUserId, {
            type: 'system',
            title: 'Guide clocked in',
            message: `${name} clocked in for today's shift at ${at}.`,
            data: {
                link_view: 'it_dashboard',
                shift_id: shiftId,
                guide_user_id: guideUserId,
                event: 'guide_clock_in'
            }
        });
        if (sent) itCount += 1;
    }

    return { guide: Boolean(guideNote), it_staff: itCount };
}

async function notifyGuideShiftClockOut({ guideUserId, guideName, shiftId, actualEnd, workedHours }) {
    if (!guideUserId) return false;

    const at = formatClockTime(actualEnd);
    const hours = Number.isFinite(Number(workedHours)) ? Number(workedHours).toFixed(2) : null;
    const note = await createInAppNotification(guideUserId, {
        type: 'system',
        title: 'Shift ended',
        message: hours
            ? `You clocked out at ${at}. Time on duty: ${hours} h.`
            : `You clocked out at ${at}.`,
        data: { link_view: 'guide_dashboard', shift_id: shiftId, event: 'guide_clock_out' }
    });

    const itUserIds = await listItStaffUserIds();
    for (const itUserId of itUserIds) {
        if (itUserId === guideUserId) continue;
        await createInAppNotification(itUserId, {
            type: 'system',
            title: 'Guide clocked out',
            message: `${guideName || 'A guide'} clocked out at ${at}${hours ? ` (${hours} h on duty)` : ''}.`,
            data: {
                link_view: 'it_dashboard',
                shift_id: shiftId,
                guide_user_id: guideUserId,
                event: 'guide_clock_out'
            }
        });
    }

    return Boolean(note);
}

module.exports = {
    createInAppNotification,
    notifyFeedbackResponse,
    notifyProximityAlert,
    notifyGuideShiftClockIn,
    notifyGuideShiftClockOut,
    listItStaffUserIds
};
