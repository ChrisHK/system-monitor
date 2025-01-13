const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get location for a serial number
router.get('/:serialNumber', async (req, res) => {
    const { serialNumber } = req.params;
    
    try {
        const query = `
            SELECT * FROM item_locations 
            WHERE serialnumber = $1
            ORDER BY updated_at DESC
            LIMIT 1
        `;
        
        const result = await pool.query(query, [serialNumber]);
        
        if (result.rows.length === 0) {
            return res.json({
                success: false,
                error: 'Location not found'
            });
        }
        
        res.json({
            success: true,
            location: result.rows[0]
        });
    } catch (error) {
        console.error('Error getting location:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get location'
        });
    }
});

// Update location for a serial number
router.post('/:serialNumber', async (req, res) => {
    const { serialNumber } = req.params;
    const locationData = req.body;
    
    try {
        const query = `
            INSERT INTO item_locations (serialnumber, location, store_id, store_name, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING *
        `;
        
        const result = await pool.query(query, [
            serialNumber,
            locationData.location,
            locationData.storeId || null,
            locationData.storeName || null
        ]);
        
        res.json({
            success: true,
            location: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update location'
        });
    }
});

// Get locations for multiple serial numbers
router.post('/batch', async (req, res) => {
    const { serialNumbers } = req.body;
    
    if (!Array.isArray(serialNumbers)) {
        return res.status(400).json({
            success: false,
            error: 'serialNumbers must be an array'
        });
    }
    
    try {
        const query = `
            SELECT DISTINCT ON (serialnumber) *
            FROM item_locations
            WHERE serialnumber = ANY($1)
            ORDER BY serialnumber, updated_at DESC
        `;
        
        const result = await pool.query(query, [serialNumbers]);
        
        res.json({
            success: true,
            locations: result.rows
        });
    } catch (error) {
        console.error('Error getting batch locations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get batch locations'
        });
    }
});

module.exports = router; 