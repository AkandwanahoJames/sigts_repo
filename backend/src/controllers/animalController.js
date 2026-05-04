// backend/src/controllers/animalController.js
const { pool } = require('../config/database');
const { logger } = require('../utils/logger');

/**
 * Get all animals
 */
async function getAnimals(req, res) {
    const { category, search, limit = 300, offset = 0 } = req.query;

    try {
        let query = `
            SELECT animal_id, name, scientific_name, conservation_status,
                   description, lifespan,
                   habitat, diet, image_urls, audio_call_url, fun_facts,
                   (SELECT COUNT(*) FROM sightings WHERE animal_id = a.animal_id AND verification_status = 'verified') as sighting_count
            FROM animals a
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (category && category !== 'all') {
            query += ` AND category = $${paramIndex++}`;
            params.push(category);
        }

        if (search) {
            query += ` AND (name ILIKE $${paramIndex++} OR scientific_name ILIKE $${paramIndex++})`;
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ` ORDER BY name LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get total count for pagination
        const countResult = await pool.query('SELECT COUNT(*) FROM animals');
        const total = parseInt(countResult.rows[0].count);

        res.json({
            animals: result.rows,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: parseInt(offset) + result.rows.length < total
            }
        });

    } catch (error) {
        logger.error('Get animals error:', error);
        res.status(500).json({ error: 'Failed to fetch animals' });
    }
}

/**
 * Get animal by ID
 */
async function getAnimalById(req, res) {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `SELECT a.*, 
                    array_agg(DISTINCT l.name) FILTER (WHERE l.name IS NOT NULL) as common_locations,
                    array_agg(DISTINCT l.location_id) FILTER (WHERE l.location_id IS NOT NULL) as location_ids,
                    (SELECT COUNT(*) FROM sightings WHERE animal_id = a.animal_id AND verification_status = 'verified') as total_sightings,
                    (SELECT AVG(number_observed) FROM sightings WHERE animal_id = a.animal_id AND verification_status = 'verified') as avg_group_size
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

        // Increment view count
        await pool.query(
            'UPDATE animals SET view_count = COALESCE(view_count, 0) + 1 WHERE animal_id = $1',
            [id]
        );

        res.json(result.rows[0]);

    } catch (error) {
        logger.error('Get animal error:', error);
        res.status(500).json({ error: 'Failed to fetch animal' });
    }
}

module.exports = { getAnimals, getAnimalById };