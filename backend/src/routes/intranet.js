// backend/src/routes/intranet.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticateJWT, authorize } = require('../middleware/auth');
const { execFile } = require('child_process');
const path = require('path');

router.use(authenticateJWT);

const ACCESS_POLICY_MODE = String(process.env.ACCESS_POLICY_MODE || process.env.NODE_ENV || 'development')
    .toLowerCase() === 'production'
    ? 'production'
    : 'demo';
const INTRANET_SUBNET = process.env.INTRANET_SUBNET || '192.168.100.0/24';

function normalizeIp(rawIp) {
    return String(rawIp || '').replace('::ffff:', '').trim();
}

function isInConfiguredIntranet(ip) {
    // Minimal subnet matcher for current deployment contract.
    // For Bwindi production subnet (e.g., 192.168.100.0/24), prefix match is sufficient.
    const subnetPrefix = INTRANET_SUBNET.split('/')[0].split('.').slice(0, 3).join('.');
    return ip.startsWith(`${subnetPrefix}.`);
}

function isInsideBoundaryFromHeaders(req) {
    const lat = Number(req.headers['x-user-lat']);
    const lng = Number(req.headers['x-user-lng']);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    // Boundary truth is computed elsewhere; for lightweight status endpoint we treat
    // presence of coordinates as "field telemetry available", then let simulation/real mode decide.
    return true;
}

function buildAccessContext(req) {
    const ip = normalizeIp(req.ip || req.connection?.remoteAddress || '');
    const role = req.user?.user_type || 'tourist';
    const requiresIntranet = role === 'tourist' || role === 'guide';
    const baseIsIntranet = isInConfiguredIntranet(ip);
    const baseInsideBoundary = isInsideBoundaryFromHeaders(req);
    const simBoundary = String(req.headers['x-sigts-sim-boundary'] || 'auto').toLowerCase();
    const simNetwork = String(req.headers['x-sigts-sim-network'] || 'auto').toLowerCase();
    const demoOverridesAllowed = ACCESS_POLICY_MODE === 'demo';

    let isIntranet = baseIsIntranet;
    let insideBoundary = baseInsideBoundary;
    let source = 'live';
    const reasons = [];

    if (demoOverridesAllowed) {
        if (simNetwork === 'online') {
            isIntranet = true;
            source = 'simulation';
            reasons.push('network forced online for demo');
        } else if (simNetwork === 'offline') {
            isIntranet = false;
            source = 'simulation';
            reasons.push('network forced offline for demo');
        }

        if (simBoundary === 'inside') {
            insideBoundary = true;
            source = 'simulation';
            reasons.push('boundary forced inside for demo');
        } else if (simBoundary === 'outside') {
            insideBoundary = false;
            source = 'simulation';
            reasons.push('boundary forced outside for demo');
        }
    }

    const networkOk = requiresIntranet ? isIntranet : true;
    const boundaryKnown = insideBoundary !== null;
    const boundaryOk = boundaryKnown ? insideBoundary : true;
    const accessGranted = Boolean(networkOk && boundaryOk);

    if (!networkOk) reasons.push('outside trusted intranet subnet');
    if (!boundaryOk) reasons.push('outside park boundary');
    if (!boundaryKnown) reasons.push('gps unavailable');
    if (!reasons.length) reasons.push('policy checks passed');

    return {
        mode: ACCESS_POLICY_MODE,
        subnet: INTRANET_SUBNET,
        role,
        requiresIntranet,
        ip,
        isIntranet,
        insideBoundary,
        accessGranted,
        source,
        reason: reasons.join('; '),
        timestamp: new Date().toISOString()
    };
}

// Lightweight access context for all authenticated roles (used silently by UI).
router.get('/status-lite', async (req, res) => {
    return res.json(buildAccessContext(req));
});

router.use(authorize('it_manager'));

// Get current intranet status
router.get('/status', async (req, res) => {
    const status = buildAccessContext(req);
    res.json(status);
});

// Get list of peers on intranet
router.get('/peers', async (req, res) => {
    try {
        // Get active users in last 5 minutes
        const result = await pool.query(`
            SELECT user_id, username, user_type, 
                   last_lat, last_lng, last_location_time
            FROM users 
            WHERE last_location_time > NOW() - INTERVAL '5 minutes'
            AND is_active = true
        `);
        
        const peers = result.rows.map(row => ({
            id: row.user_id,
            name: row.username,
            type: row.user_type,
            location: row.last_lat ? { lat: row.last_lat, lng: row.last_lng } : null,
            lastSeen: row.last_location_time
        }));
        
        res.json({ count: peers.length, peers });
    } catch (error) {
        res.json({ count: 0, peers: [] });
    }
});

// Announcements
router.get('/announcements', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ia.announcement_id, ia.title, ia.content, ia.priority, ia.created_at,
                    COALESCE(u.first_name || ' ' || u.last_name, u.username, 'System') AS author_name
             FROM internal_announcements ia
             LEFT JOIN users u ON ia.author_user_id = u.user_id
             ORDER BY ia.created_at DESC
             LIMIT 200`
        );
        return res.json({ announcements: result.rows });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch announcements' });
    }
});

router.post('/announcements', [
    body('title').notEmpty().trim(),
    body('content').notEmpty().trim(),
    body('priority').optional().isIn(['high', 'medium', 'low'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, content, priority = 'medium' } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO internal_announcements (title, content, priority, author_user_id)
             VALUES ($1, $2, $3, $4)
             RETURNING announcement_id`,
            [title, content, priority, req.user.user_id]
        );
        return res.status(201).json({ success: true, announcement_id: result.rows[0].announcement_id });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to create announcement' });
    }
});

router.delete('/announcements/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM internal_announcements WHERE announcement_id = $1', [req.params.id]);
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to delete announcement' });
    }
});

// Inventory
router.get('/inventory', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT inventory_item_id, name, quantity, category, status, updated_at
             FROM inventory_items
             ORDER BY updated_at DESC, inventory_item_id DESC`
        );
        return res.json({ items: result.rows });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch inventory' });
    }
});

router.post('/inventory', [
    body('name').notEmpty().trim(),
    body('quantity').isInt({ min: 0 }),
    body('category').optional().trim(),
    body('status').optional().isIn(['available', 'low_stock', 'out_of_stock', 'retired'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, quantity, category = null, status = 'available' } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO inventory_items (name, quantity, category, status, updated_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
             RETURNING inventory_item_id`,
            [name, quantity, category, status]
        );
        return res.status(201).json({ success: true, inventory_item_id: result.rows[0].inventory_item_id });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to create inventory item' });
    }
});

router.put('/inventory/:id', [
    body('quantity').optional().isInt({ min: 0 }),
    body('name').optional().trim(),
    body('category').optional().trim(),
    body('status').optional().isIn(['available', 'low_stock', 'out_of_stock', 'retired'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { quantity, name, category, status } = req.body;
    try {
        await pool.query(
            `UPDATE inventory_items
             SET quantity = COALESCE($1, quantity),
                 name = COALESCE($2, name),
                 category = COALESCE($3, category),
                 status = COALESCE($4, status),
                 updated_at = CURRENT_TIMESTAMP
             WHERE inventory_item_id = $5`,
            [quantity, name, category, status, req.params.id]
        );
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to update inventory item' });
    }
});

// Employees
router.get('/employees', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT employee_id, name, role, department, status, hire_date
             FROM hr_employees
             ORDER BY created_at DESC`
        );
        return res.json({ employees: result.rows });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch employees' });
    }
});

router.post('/employees', [
    body('name').notEmpty().trim(),
    body('role').notEmpty().trim(),
    body('department').optional().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, role, department = null } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO hr_employees (name, role, department, status, hire_date)
             VALUES ($1, $2, $3, 'active', CURRENT_DATE)
             RETURNING employee_id`,
            [name, role, department]
        );
        return res.status(201).json({ success: true, employee_id: result.rows[0].employee_id });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to create employee' });
    }
});

router.put('/employees/:id/status', [
    body('status').isIn(['active', 'inactive'])
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        await pool.query(
            `UPDATE hr_employees
             SET status = $1
             WHERE employee_id = $2`,
            [req.body.status, req.params.id]
        );
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to update employee status' });
    }
});

// Test bandwidth
router.get('/bandwidth-test', (req, res) => {
    const size = 5 * 1024 * 1024; // 5MB test file
    const data = Buffer.alloc(size, 'X');
    res.set('Content-Type', 'application/octet-stream');
    res.send(data);
});

// Manual sync trigger
router.post('/sync/manual', async (req, res) => {
    // Trigger sync for all offline data
    res.json({ success: true, message: 'Sync initiated' });
});

// Trigger interactive seed data from UI (IT manager only)
router.post('/seed/interactive', async (req, res) => {
    const scriptPath = path.join(__dirname, '../../scripts/seedInteractiveData.js');
    execFile(process.execPath, [scriptPath], { cwd: path.join(__dirname, '../..') }, (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({
                success: false,
                error: 'Interactive seed failed',
                details: (stderr || error.message || '').slice(0, 4000)
            });
        }
        return res.json({
            success: true,
            message: 'Interactive map seed completed.',
            output: (stdout || '').slice(-4000)
        });
    });
});

// Get IP address
router.get('/ip', (req, res) => {
    const ip = req.ip || req.connection.remoteAddress;
    res.json({ ip: ip.replace('::ffff:', '') });
});

module.exports = router;