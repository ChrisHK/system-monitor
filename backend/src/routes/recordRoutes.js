const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get all records
router.get('/', async (req, res) => {
    try {
        console.log('GET /api/records - Fetching all records');
        
        const query = `
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
                is_current
            FROM system_records
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
            touch_screen: record.touch_screen === 'Yes Detected'
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

module.exports = router; 