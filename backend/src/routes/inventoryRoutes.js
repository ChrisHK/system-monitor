const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { checkMainPermission } = require('../middleware/checkPermission');
const pool = require('../db');

// Get inventory items with pagination
router.get('/', auth, checkMainPermission('inventory'), async (req, res) => {
    const { page = 1, limit = 50, searchText } = req.query;
    const offset = (page - 1) * limit;

    try {
        let query = `
            SELECT 
                r.*,
                COALESCE(l.location, 'inventory') as location,
                l.store_id,
                l.store_name,
                l.updated_at as location_updated
            FROM system_records r
            LEFT JOIN item_locations l ON r.serialnumber = l.serialnumber
            WHERE (l.location = 'inventory' OR l.location IS NULL)
        `;

        const params = [];
        
        if (searchText) {
            params.push(`%${searchText}%`);
            query += ` AND (
                r.serialnumber ILIKE $${params.length} OR 
                r.computername ILIKE $${params.length} OR 
                r.model ILIKE $${params.length}
            )`;
        }

        // Get total count
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM (${query}) as subquery`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        // Add pagination
        query += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        res.json({
            success: true,
            items: result.rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching inventory items:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch inventory items'
        });
    }
});

// Get RAM inventory
router.get('/ram', auth, checkMainPermission('inventory_ram'), async (req, res) => {
    try {
        const query = `
            SELECT 
                r.*,
                COALESCE(l.location, 'inventory') as location,
                l.store_id,
                l.store_name,
                l.updated_at as location_updated
            FROM system_records r
            LEFT JOIN item_locations l ON r.serialnumber = l.serialnumber
            WHERE (l.location = 'inventory' OR l.location IS NULL)
            AND r.ram_gb IS NOT NULL
            ORDER BY r.ram_gb DESC
        `;

        const result = await pool.query(query);

        res.json({
            success: true,
            items: result.rows
        });
    } catch (error) {
        console.error('Error fetching RAM inventory:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch RAM inventory'
        });
    }
});

module.exports = router; 