// backend/src/routes/animals.js
const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateJWT } = require('../middleware/auth');

// =====================================================
// GET /api/animals
// Get all animals
// =====================================================
router.get('/', authenticateJWT, async (req, res) => {
    const { search, limit = 50, offset = 0 } = req.query;

    try {
        let query = `
            SELECT animal_id, name, scientific_name, description,
                   conservation_status, habitat, diet, lifespan, image_urls,
                   fun_facts
            FROM animals
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (search) {
            query += ` AND (name ILIKE $${paramIndex++} OR scientific_name ILIKE $${paramIndex++})`;
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY name LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        res.json({
            animals: result.rows,
            total: result.rowCount,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('Get animals error:', error);
        res.status(500).json({ error: 'Failed to fetch animals' });
    }
});

// =====================================================
// GET /api/animals/:id
// Get animal by ID
// =====================================================
router.get('/:id', authenticateJWT, async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `SELECT a.*, 
                    array_agg(DISTINCT l.name) FILTER (WHERE l.name IS NOT NULL) as common_locations,
                    array_agg(DISTINCT l.location_id) FILTER (WHERE l.location_id IS NOT NULL) as location_ids
             FROM animals a
             LEFT JOIN animal_locations al ON a.animal_id = al.animal_id
             LEFT JOIN locations l ON al.location_id = l.location_id
             WHERE a.animal_id = $1
             GROUP BY a.animal_id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Animal not found' });
        }

        res.json(result.rows[0]);

    } catch (error) {
        console.error('Get animal error:', error);
        res.status(500).json({ error: 'Failed to fetch animal' });
    }
});

module.exports = router;
