const express = require('express');
const router = express.Router();
const pool = require('../db');
const { auth, checkRole } = require('../middleware/auth');

// Get duplicate records (admin only)
router.get('/duplicates', auth, checkRole(['admin']), async (req, res) => {
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

// Clean up duplicate records (admin only)
router.post('/cleanup-duplicates', auth, checkRole(['admin']), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

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

// Search records
router.get('/search', auth, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
        }

        // Format search terms for System SKU matching
        const searchTerms = q.toLowerCase().split(' ');
        const formattedSearch = searchTerms.join('_');
        const likeTerms = searchTerms.map((_, index) => `$${index + 2}`);

        const query = `
            SELECT *
            FROM system_records
            WHERE 
                is_current = true 
                AND (
                    serialnumber ILIKE $1
                    OR model ILIKE $1
                    OR manufacturer ILIKE $1
                    OR systemsku ILIKE $1
                    OR computername ILIKE $1
                    OR operatingsystem ILIKE $1
                    OR cpu ILIKE $1
                    OR CAST(id AS TEXT) ILIKE $1
                    OR systemsku ILIKE '%' || $2 || '%'
                    ${searchTerms.slice(1).map((_, idx) => 
                        `OR systemsku ILIKE '%' || ${likeTerms[idx + 1]} || '%'`
                    ).join('\n')}
                )
            ORDER BY created_at DESC
            LIMIT 50
        `;

        // Debug logging
        console.log('Search debug info:');
        console.log('Original search term:', q);
        console.log('Formatted search:', formattedSearch);
        console.log('Search terms:', searchTerms);

        const params = [`%${q}%`, ...searchTerms];
        console.log('Query parameters:', params);

        const result = await pool.query(query, params);
        console.log('Search results count:', result.rows.length);

        res.json({
            success: true,
            records: result.rows
        });
    } catch (error) {
        console.error('Error searching records:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all records
router.get('/', auth, async (req, res) => {
    try {
        const result = await pool.query(`
            WITH RankedRecords AS (
                SELECT 
                    r.*,
                    s.store_id,
                    st.name as store_name,
                    ROW_NUMBER() OVER (
                        PARTITION BY r.serialnumber 
                        ORDER BY r.created_at DESC, r.id DESC
                    ) as rn,
                    COUNT(*) OVER (PARTITION BY r.serialnumber) as serial_count
                FROM system_records r
                LEFT JOIN store_items s ON r.id = s.record_id
                LEFT JOIN stores st ON s.store_id = st.id
                WHERE r.is_current = true
            )
            SELECT 
                rr.*,
                CASE
                    WHEN rr.store_id IS NOT NULL THEN 'store'
                    ELSE 'inventory'
                END as location,
                rr.serial_count > 1 as is_duplicate
            FROM RankedRecords rr
            WHERE rr.rn = 1
            ORDER BY rr.created_at DESC
        `);
        
        const records = result.rows.map(record => ({
            ...record,
            location: {
                location: record.location,
                storeName: record.store_name
            }
        }));
        
        res.json({
            success: true,
            records: records,
            total: records.length
        });
    } catch (error) {
        console.error('Error fetching records:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete a record (admin only)
router.delete('/:id', auth, checkRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'UPDATE system_records SET is_current = false WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Record not found'
            });
        }

        res.json({
            success: true,
            message: 'Record deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting record:', error);
        res.status(500).json({
            success: false,
            error: error.message
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

// Get records with locations
router.get('/with-locations', async (req, res) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                r.*,
                CASE
                    WHEN si.store_id IS NOT NULL THEN 'store'
                    ELSE 'inventory'
                END as location,
                s.name as store_name
            FROM system_records r
            LEFT JOIN store_items si ON r.id = si.record_id
            LEFT JOIN stores s ON si.store_id = s.id
            WHERE r.is_current = true
            ORDER BY r.created_at DESC
        `;
        
        const result = await client.query(query);
        
        res.json({
            success: true,
            records: result.rows
        });
    } catch (error) {
        console.error('Error fetching records with locations:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});

module.exports = router; 