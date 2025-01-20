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
    
    if (!Array.isArray(serialNumbers) || serialNumbers.length === 0) {
        return res.status(400).json({
            success: false,
            error: 'serialNumbers must be a non-empty array'
        });
    }

    // Log request details
    console.log('Batch location request:', {
        serialNumbersCount: serialNumbers.length,
        firstFew: serialNumbers.slice(0, 5)
    });
    
    try {
        // First check if the table exists
        const checkTableQuery = `
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'item_locations'
            );
        `;
        
        const tableExists = await pool.query(checkTableQuery);
        if (!tableExists.rows[0].exists) {
            // Create the table if it doesn't exist
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS item_locations (
                    id SERIAL PRIMARY KEY,
                    serialnumber TEXT NOT NULL,
                    location TEXT NOT NULL DEFAULT 'inventory',
                    store_id TEXT,
                    store_name TEXT,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_item_locations_serialnumber ON item_locations(serialnumber);
            `;
            await pool.query(createTableQuery);
            console.log('Created item_locations table');
        }

        // Get all known locations
        const query = `
            WITH latest_locations AS (
                SELECT DISTINCT ON (serialnumber) 
                    serialnumber, 
                    location, 
                    store_id, 
                    store_name, 
                    updated_at
                FROM item_locations
                WHERE serialnumber = ANY($1::text[])
                ORDER BY serialnumber, updated_at DESC
            )
            SELECT * FROM latest_locations
        `;
        
        console.log('Executing query with params:', serialNumbers);
        const result = await pool.query(query, [serialNumbers]);
        console.log('Query result:', {
            rowCount: result.rowCount,
            firstRow: result.rows[0]
        });
        
        // Create a map of known locations
        const locationMap = new Map(
            result.rows.map(row => [row.serialnumber, row])
        );
        
        // Create the response array with default 'inventory' for unknown locations
        const locations = serialNumbers.map(serialNumber => {
            const known = locationMap.get(serialNumber);
            if (known) {
                return known;
            }
            return {
                serialnumber: serialNumber,
                location: 'inventory',
                store_id: null,
                store_name: null,
                updated_at: new Date()
            };
        });
        
        // Log response summary
        console.log('Response summary:', {
            totalLocations: locations.length,
            knownLocations: locationMap.size,
            defaultLocations: locations.length - locationMap.size
        });
        
        res.json({
            success: true,
            locations: locations
        });
    } catch (error) {
        // Detailed error logging
        console.error('Error in batch location check:', {
            error: error.message,
            stack: error.stack,
            code: error.code,
            detail: error.detail
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to get batch locations',
            details: error.message,
            code: error.code
        });
    }
});

module.exports = router; 