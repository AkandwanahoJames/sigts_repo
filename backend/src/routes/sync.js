// backend/src/routes/sync.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateJWT } = require('../middleware/auth');

// =====================================================
// POST /api/sync/upload
// Upload offline queued data
// =====================================================
router.post('/upload', authenticateJWT, [
    body('items').isArray(),
    body('items.*.action').isIn(['create', 'update', 'delete']),
    body('items.*.table').isString(),
    body('items.*.data').isObject()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { items, device_id, sync_version } = req.body;
    const userId = req.user.user_id;

    const results = [];

    for (const item of items) {
        try {
            let result;
            switch (item.action) {
                case 'create':
                    if (item.table === 'sightings') {
                        result = await pool.query(
                            `INSERT INTO sightings (sighting_id, animal_id, location_id, 
                                reported_by_tourist, number_observed, behavior, photo_urls, notes, timestamp)
                             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
                             RETURNING sighting_id`,
                            [item.data.animal_id, item.data.location_id, userId, 
                             item.data.number_observed, item.data.behavior, item.data.photo_urls, 
                             item.data.notes, item.data.timestamp]
                        );
                        results.push({ success: true, id: result.rows[0].sighting_id, action: 'create', table: item.table });
                    } else {
                        results.push({
                            success: false,
                            action: 'create',
                            table: item.table,
                            error: `Offline sync for table "${item.table}" is not implemented on the server. Only "sightings" create is supported. Your change was not applied — keep it in the local queue or retry after an app update.`
                        });
                    }
                    break;

                case 'update':
                    results.push({
                        success: false,
                        action: 'update',
                        table: item.table,
                        error: `Offline "${item.action}" on "${item.table}" is not supported by this server build. No rows were modified.`
                    });
                    break;

                case 'delete':
                    results.push({
                        success: false,
                        action: 'delete',
                        table: item.table,
                        error: `Offline "${item.action}" on "${item.table}" is not supported by this server build. No rows were modified.`
                    });
                    break;
            }
        } catch (error) {
            console.error('Sync item error:', error);
            results.push({ success: false, error: error.message, action: item.action, table: item.table });
        }
    }

    // Update user's sync version
    await pool.query(
        `UPDATE tourists SET last_sync_time = CURRENT_TIMESTAMP, offline_data_version = $1
         WHERE user_id = $2`,
        [sync_version || 1, userId]
    );

    res.json({
        success: true,
        processed: results.length,
        results,
        server_version: 1
    });
});

// =====================================================
// GET /api/sync/download
// Download content updates for offline
// =====================================================
router.get('/download', authenticateJWT, async (req, res) => {
    const { last_sync, version } = req.query;
    const userId = req.user.user_id;

    try {
        const since = last_sync || new Date(0).toISOString();

        const [animals, locations, cultural] = await Promise.all([
            pool.query(
                `SELECT animal_id, name, scientific_name, description, conservation_status,
                        habitat, diet, image_urls, audio_call_url, fun_facts
                 FROM animals
                 WHERE updated_at > $1`,
                [since]
            ),
            pool.query(
                `SELECT location_id, name, location_type, ST_X(coordinates) as longitude, 
                        ST_Y(coordinates) as latitude, description, image_urls, audio_guide_url,
                        trigger_radius, facilities, best_viewing_time
                 FROM locations
                 WHERE updated_at > $1`,
                [since]
            ),
            pool.query(
                `SELECT narrative_id, title_en, title_local, narrative_en, narrative_local,
                        storyteller_name, community, story_type, audio_url, image_urls,
                        verified_by_community
                 FROM cultural_narratives
                 WHERE updated_at > $1 AND verified_by_community = true`,
                [since]
            )
        ]);

        res.json({
            success: true,
            version: 1,
            timestamp: new Date().toISOString(),
            data: {
                animals: animals.rows,
                locations: locations.rows,
                cultural: cultural.rows
            }
        });

    } catch (error) {
        console.error('Download offline content error:', error);
        res.status(500).json({ error: 'Failed to download content' });
    }
});

// =====================================================
// GET /api/sync/status
// Get sync status for user
// =====================================================
router.get('/status', authenticateJWT, async (req, res) => {
    const userId = req.user.user_id;

    try {
        const result = await pool.query(
            `SELECT last_sync_time, offline_data_version
             FROM tourists
             WHERE user_id = $1`,
            [userId]
        );

        const pendingQueue = await pool.query(
            `SELECT COUNT(*) as pending
             FROM sync_queue
             WHERE user_id = $1 AND status = 'pending'`,
            [userId]
        );

        res.json({
            last_sync: result.rows[0]?.last_sync_time || null,
            version: result.rows[0]?.offline_data_version || 1,
            pending_items: parseInt(pendingQueue.rows[0].pending)
        });

    } catch (error) {
        console.error('Get sync status error:', error);
        res.status(500).json({ error: 'Failed to get sync status' });
    }
});

// =====================================================
// POST /api/sync/queue
// Add item to sync queue (offline fallback)
// =====================================================
router.post('/queue', authenticateJWT, [
    body('action').isIn(['create', 'update', 'delete']),
    body('table').isString(),
    body('data').isObject()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { action, table, data } = req.body;
    const userId = req.user.user_id;

    try {
        const result = await pool.query(
            `INSERT INTO sync_queue (user_id, action, table_name, data, status, created_at)
             VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP)
             RETURNING queue_id`,
            [userId, action, table, JSON.stringify(data)]
        );

        res.status(201).json({
            success: true,
            queue_id: result.rows[0].queue_id,
            message: 'Item queued for sync'
        });

    } catch (error) {
        console.error('Queue item error:', error);
        res.status(500).json({ error: 'Failed to queue item' });
    }
});

module.exports = router;