const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get duplicate records
router.get('/duplicates', async (req, res) => {
    try {
        const result = await pool.query(`
            WITH duplicates AS (
                SELECT serialnumber
                FROM system_records
                WHERE is_current = true
                GROUP BY serialnumber
                HAVING COUNT(*) > 1
            )
            SELECT DISTINCT r.serialnumber
            FROM system_records r
            JOIN duplicates d ON r.serialnumber = d.serialnumber
            ORDER BY r.serialnumber
        `);
        
        res.json({
            success: true,
            duplicates: result.rows
        });
    } catch (error) {
        console.error('Error fetching duplicates:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Clean up duplicate records - keep only the newest
router.post('/cleanup-duplicates', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Find all duplicate serial numbers and their records
        const findDuplicatesQuery = `
            WITH duplicates AS (
                SELECT serialnumber
                FROM system_records
                WHERE is_current = true
                GROUP BY serialnumber
                HAVING COUNT(*) > 1
            )
            SELECT r.id, r.serialnumber, r.created_at
            FROM system_records r
            JOIN duplicates d ON r.serialnumber = d.serialnumber
            WHERE r.is_current = true
            ORDER BY r.serialnumber, r.created_at DESC
        `;

        const duplicates = await client.query(findDuplicatesQuery);
        
        // Process each duplicate group
        let currentSerial = null;
        let isFirst = true;
        let deletedCount = 0;
        
        for (const record of duplicates.rows) {
            if (currentSerial !== record.serialnumber) {
                currentSerial = record.serialnumber;
                isFirst = true;
                continue;
            }
            
            if (!isFirst) {
                // Delete older duplicates (soft delete by setting is_current = false)
                await client.query(`
                    UPDATE system_records 
                    SET is_current = false 
                    WHERE id = $1
                `, [record.id]);
                deletedCount++;
            }
            isFirst = false;
        }

        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: `Successfully cleaned up duplicates. Removed ${deletedCount} older duplicate records.`
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error cleaning up duplicates:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});

// Search records by field and term
router.get('/search', async (req, res) => {
    const { field, term } = req.query;
    
    try {
        // Validate required parameters
        if (!field || !term) {
            return res.status(400).json({
                success: false,
                error: 'Field and search term are required'
            });
        }

        // Build the query with ILIKE for case-insensitive search
        const query = `
            WITH RankedRecords AS (
                SELECT *,
                    ROW_NUMBER() OVER (
                        PARTITION BY serialnumber 
                        ORDER BY created_at DESC, id DESC
                    ) as rn
                FROM system_records
                WHERE ${field} ILIKE $1 
                AND is_current = true
            )
            SELECT * FROM RankedRecords 
            WHERE rn = 1
            ORDER BY created_at DESC
        `;
        
        const result = await pool.query(query, [`%${term}%`]);
        
        res.json({
            success: true,
            records: result.rows
        });
    } catch (error) {
        console.error('Error searching records:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search records'
        });
    }
});

// Get all records
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            WITH RankedRecords AS (
                SELECT *,
                    ROW_NUMBER() OVER (
                        PARTITION BY serialnumber 
                        ORDER BY created_at DESC, id DESC
                    ) as rn
                FROM system_records
                WHERE is_current = true
            )
            SELECT * FROM RankedRecords 
            WHERE rn = 1
            ORDER BY created_at DESC
        `);
        
        res.json({
            success: true,
            records: result.rows
        });
    } catch (error) {
        console.error('Error fetching records:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete a record
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        // First check if record exists and is a duplicate
        const checkQuery = `
            SELECT r.id, r.serialnumber
            FROM system_records r
            WHERE r.id = $1
            AND r.is_current = true
            AND EXISTS (
                SELECT 1 
                FROM system_records r2 
                WHERE r2.serialnumber = r.serialnumber 
                AND r2.id != r.id 
                AND r2.is_current = true
            )
        `;
        
        const checkResult = await pool.query(checkQuery, [id]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Record not found or not a duplicate'
            });
        }

        // Delete the record (soft delete by setting is_current to false)
        const deleteQuery = `
            UPDATE system_records 
            SET is_current = false 
            WHERE id = $1 
            RETURNING id, serialnumber
        `;
        
        const result = await pool.query(deleteQuery, [id]);
        
        res.json({
            success: true,
            message: `Record ${result.rows[0].serialnumber} deleted successfully`
        });
    } catch (error) {
        console.error('Error deleting record:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete record'
        });
    }
});

// Create or update a record
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const record = req.body;
        
        // Check for existing record with same serial number
        const existingRecord = await client.query(
            'SELECT id FROM system_records WHERE serialnumber = $1',
            [record.serialnumber]
        );

        let result;
        if (existingRecord.rows.length > 0) {
            // Update existing record
            const recordId = existingRecord.rows[0].id;
            result = await client.query(`
                UPDATE system_records SET
                    computername = $1,
                    manufacturer = $2,
                    model = $3,
                    systemsku = $4,
                    operatingsystem = $5,
                    cpu = $6,
                    resolution = $7,
                    graphicscard = $8,
                    touchscreen = $9,
                    ram_gb = $10,
                    disks = $11,
                    design_capacity = $12,
                    full_charge_capacity = $13,
                    cycle_count = $14,
                    battery_health = $15,
                    created_at = NOW()
                WHERE id = $16
                RETURNING *
            `, [
                record.computername,
                record.manufacturer,
                record.model,
                record.systemsku,
                record.operatingsystem,
                record.cpu,
                record.resolution,
                record.graphicscard,
                record.touchscreen,
                record.ram_gb,
                record.disks,
                record.design_capacity,
                record.full_charge_capacity,
                record.cycle_count,
                record.battery_health,
                recordId
            ]);
        } else {
            // Insert new record
            result = await client.query(`
                INSERT INTO system_records (
                    serialnumber,
                    computername,
                    manufacturer,
                    model,
                    systemsku,
                    operatingsystem,
                    cpu,
                    resolution,
                    graphicscard,
                    touchscreen,
                    ram_gb,
                    disks,
                    design_capacity,
                    full_charge_capacity,
                    cycle_count,
                    battery_health
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING *
            `, [
                record.serialnumber,
                record.computername,
                record.manufacturer,
                record.model,
                record.systemsku,
                record.operatingsystem,
                record.cpu,
                record.resolution,
                record.graphicscard,
                record.touchscreen,
                record.ram_gb,
                record.disks,
                record.design_capacity,
                record.full_charge_capacity,
                record.cycle_count,
                record.battery_health
            ]);
        }

        await client.query('COMMIT');
        
        res.json({
            success: true,
            record: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating/updating record:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});

// Add item to outbound
router.post('/outbound/:id', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if item already exists in outbound
        const existingItem = await client.query(
            'SELECT id, serialnumber FROM outbound_items oi JOIN system_records sr ON oi.record_id = sr.id WHERE record_id = $1 AND status = $2',
            [id, 'pending']
        );
        
        if (existingItem.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: `Serial Number ${existingItem.rows[0].serialnumber} is already in outbound list`
            });
        }
        
        // Add to outbound
        const result = await client.query(
            'INSERT INTO outbound_items (record_id, status) VALUES ($1, $2) RETURNING *',
            [id, 'pending']
        );
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            item: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding to outbound:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});

// Check item location
router.get('/check-location/:serialNumber', async (req, res) => {
    const { serialNumber } = req.params;
    const client = await pool.connect();
    
    try {
        // Check if item is in any store
        const storeQuery = `
            SELECT s.name as store_name
            FROM system_records r
            JOIN store_items si ON r.id = si.record_id
            JOIN stores s ON si.store_id = s.id
            WHERE r.serialnumber = $1
        `;
        
        const storeResult = await client.query(storeQuery, [serialNumber]);
        
        if (storeResult.rows.length > 0) {
            return res.json({
                success: true,
                location: 'store',
                storeName: storeResult.rows[0].store_name
            });
        }
        
        // Check if item is in inventory
        const inventoryQuery = `
            SELECT id
            FROM system_records
            WHERE serialnumber = $1
            AND is_current = true
        `;
        
        const inventoryResult = await client.query(inventoryQuery, [serialNumber]);
        
        if (inventoryResult.rows.length > 0) {
            return res.json({
                success: true,
                location: 'inventory'
            });
        }
        
        // Item not found
        res.json({
            success: true,
            location: 'none'
        });
    } catch (error) {
        console.error('Error checking item location:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});

module.exports = router; 