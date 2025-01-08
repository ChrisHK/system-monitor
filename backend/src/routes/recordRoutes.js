const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get all records
router.get('/', async (req, res) => {
    try {
        console.log('GET /api/records - Fetching all records');
        
        // First get the list of duplicate serial numbers
        const duplicatesQuery = `
            SELECT serialnumber
            FROM system_records
            WHERE serialnumber IS NOT NULL
            AND is_current = true
            GROUP BY serialnumber
            HAVING COUNT(*) > 1
        `;
        
        const duplicatesResult = await pool.query(duplicatesQuery);
        const duplicateSerials = new Set(duplicatesResult.rows.map(row => row.serialnumber));
        
        // Main query to get records
        const query = `
            WITH RankedRecords AS (
                SELECT 
                    id,
                    systemsku,
                    serialnumber,
                    computername,
                    manufacturer,
                    model,
                    operatingsystem as os,
                    cpu,
                    resolution,
                    graphicscard as graphics,
                    touchscreen as touch_screen,
                    ram_gb,
                    disks,
                    design_capacity,
                    full_charge_capacity as full_charge,
                    cycle_count,
                    battery_health,
                    created_at,
                    is_current,
                    ROW_NUMBER() OVER (PARTITION BY serialnumber ORDER BY created_at DESC) as rn
                FROM system_records
                WHERE is_current = true
            )
            SELECT * FROM RankedRecords 
            WHERE rn = 1 OR serialnumber IN (
                SELECT serialnumber 
                FROM system_records 
                WHERE serialnumber IS NOT NULL 
                AND is_current = true
                GROUP BY serialnumber 
                HAVING COUNT(*) > 1
            )
            ORDER BY created_at DESC
        `;
        
        const result = await pool.query(query);
        console.log(`Fetched ${result.rows.length} records`);

        const transformedRecords = result.rows.map(record => ({
            ...record,
            os: record.os || 'N/A',
            cpu: record.cpu || 'N/A',
            resolution: record.resolution || 'N/A',
            graphics: record.graphics || 'N/A',
            disks: record.disks || 'N/A',
            touch_screen: record.touch_screen === 'Yes Detected',
            is_duplicate: duplicateSerials.has(record.serialnumber)
        }));

        res.json({
            success: true,
            records: transformedRecords
        });
    } catch (error) {
        console.error('Error fetching records:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch records',
            details: error.message
        });
    }
});

// Get duplicate records
router.get('/duplicates', async (req, res) => {
    try {
        const query = `
            SELECT serialnumber, COUNT(*) as count
            FROM system_records
            WHERE serialnumber IS NOT NULL
            AND is_current = true
            GROUP BY serialnumber
            HAVING COUNT(*) > 1
            ORDER BY count DESC, serialnumber
        `;

        const result = await pool.query(query);
        console.log(`Found ${result.rows.length} duplicate serials`); // 添加日誌
        
        res.json({
            success: true,
            duplicates: result.rows
        });
    } catch (error) {
        console.error('Error fetching duplicate serials:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch duplicate serials'
        });
    }
});

// Delete a record
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('DELETE /api/records/:id - Deleting record:', id);

        // First check if record exists
        const checkResult = await pool.query(
            'SELECT id, serialnumber FROM system_records WHERE id = $1',
            [id]
        );

        if (checkResult.rows.length === 0) {
            console.log('Record not found:', id);
            return res.status(404).json({
                success: false,
                error: 'Record not found'
            });
        }

        // Delete the record
        const result = await pool.query(
            'DELETE FROM system_records WHERE id = $1 RETURNING id, serialnumber',
            [id]
        );

        console.log('Record deleted successfully:', result.rows[0]);
        res.json({
            success: true,
            message: 'Record deleted successfully',
            record: result.rows[0]
        });
    } catch (error) {
        console.error('Error deleting record:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete record',
            details: error.message
        });
    }
});

module.exports = router; 