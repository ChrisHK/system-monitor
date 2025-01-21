const express = require('express');
const router = express.Router();
const pool = require('../db');
const { auth, checkRole } = require('../middleware/auth');

console.log('Inventory RMA Routes module loaded');

// Get all inventory RMA items
router.get('/', auth, async (req, res) => {
    let client;
    
    try {
        console.log('=== Starting Inventory RMA fetch ===');
        console.log('Request headers:', req.headers);
        
        client = await pool.connect();
        console.log('Database connection established');
        
        const query = `
            SELECT 
                sr.id,
                sr.serialnumber,
                sr.computername,
                sr.model,
                sr.ram_gb,
                sr.operatingsystem as operating_system,
                sr.cpu,
                sr.disks,
                sr.systemsku as system_sku,
                r.id as rma_id,
                r.store_id,
                r.record_id,
                r.reason,
                r.notes,
                r.rma_date,
                r.store_status,
                r.inventory_status,
                r.location_type,
                r.received_at,
                r.processed_at,
                r.completed_at,
                r.failed_at,
                r.failed_reason,
                s.name as store_name
            FROM store_rma r
            LEFT JOIN system_records sr ON r.record_id = sr.id
            LEFT JOIN stores s ON r.store_id = s.id
            WHERE r.location_type = 'inventory'
            ORDER BY 
                CASE 
                    WHEN r.inventory_status = 'receive' THEN 1
                    WHEN r.inventory_status = 'process' THEN 2
                    WHEN r.inventory_status = 'failed' THEN 3
                    WHEN r.inventory_status = 'complete' THEN 4
                    ELSE 5
                END,
                r.rma_date DESC
        `;

        console.log('Executing query...');
        const result = await client.query(query);
        console.log('Query executed successfully');
        
        console.log('Query results:', {
            rowCount: result.rows.length,
            firstRow: result.rows[0],
            allRows: result.rows
        });
        
        res.json({
            success: true,
            rma_items: result.rows
        });

        console.log('=== Inventory RMA fetch completed successfully ===');
    } catch (error) {
        console.error('=== Error in Inventory RMA fetch ===');
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            detail: error.detail
        });
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (client) {
            try {
                console.log('Releasing database connection');
                await client.release();
                console.log('Database connection released successfully');
            } catch (releaseError) {
                console.error('Error releasing database connection:', releaseError);
            }
        }
    }
});

// Process RMA item
router.put('/:rmaId/process', auth, async (req, res) => {
    let client;
    const { rmaId } = req.params;
    
    try {
        client = await pool.connect();
        
        await client.query('BEGIN');

        // Check if RMA exists and is in receive status
        const checkResult = await client.query(`
            SELECT id, inventory_status 
            FROM store_rma 
            WHERE id = $1 AND location_type = 'inventory'
        `, [rmaId]);

        if (checkResult.rows.length === 0) {
            throw new Error('RMA item not found');
        }

        if (checkResult.rows[0].inventory_status !== 'receive') {
            throw new Error('RMA item is not in receive status');
        }

        // Update RMA status
        const result = await client.query(`
            UPDATE store_rma
            SET 
                inventory_status = 'process'::rma_inventory_status,
                processed_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `, [rmaId]);

        await client.query('COMMIT');
        
        res.json({
            success: true,
            rma: result.rows[0]
        });
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error processing RMA:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// Complete RMA item
router.put('/:rmaId/complete', auth, async (req, res) => {
    let client;
    const { rmaId } = req.params;
    
    try {
        client = await pool.connect();
        
        await client.query('BEGIN');

        // Check if RMA exists and is in process status
        const checkResult = await client.query(`
            SELECT id, inventory_status 
            FROM store_rma 
            WHERE id = $1 AND location_type = 'inventory'
        `, [rmaId]);

        if (checkResult.rows.length === 0) {
            throw new Error('RMA item not found');
        }

        if (checkResult.rows[0].inventory_status !== 'process') {
            throw new Error('RMA item is not in process status');
        }

        // Update RMA status
        const result = await client.query(`
            UPDATE store_rma
            SET 
                inventory_status = 'complete'::rma_inventory_status,
                store_status = 'completed'::rma_store_status,
                completed_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `, [rmaId]);

        await client.query('COMMIT');
        
        res.json({
            success: true,
            rma: result.rows[0]
        });
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error completing RMA:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// Fail RMA item
router.put('/:rmaId/fail', auth, async (req, res) => {
    let client;
    const { rmaId } = req.params;
    const { failed_reason } = req.body;
    
    try {
        client = await pool.connect();
        
        await client.query('BEGIN');

        // Check if RMA exists and is in receive or process status
        const checkResult = await client.query(`
            SELECT id, inventory_status 
            FROM store_rma 
            WHERE id = $1 AND location_type = 'inventory'
        `, [rmaId]);

        if (checkResult.rows.length === 0) {
            throw new Error('RMA item not found');
        }

        if (!['receive', 'process'].includes(checkResult.rows[0].inventory_status)) {
            throw new Error('RMA item cannot be marked as failed in its current status');
        }

        // Update RMA status
        const result = await client.query(`
            UPDATE store_rma
            SET 
                inventory_status = 'failed'::rma_inventory_status,
                store_status = 'failed'::rma_store_status,
                failed_at = CURRENT_TIMESTAMP,
                failed_reason = $2
            WHERE id = $1
            RETURNING *
        `, [rmaId, failed_reason || null]);

        await client.query('COMMIT');
        
        res.json({
            success: true,
            rma: result.rows[0]
        });
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error failing RMA:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// Search RMA items
router.get('/search/:serialNumber', auth, async (req, res) => {
    let client;
    const { serialNumber } = req.params;
    
    try {
        client = await pool.connect();
        
        const query = `
            SELECT 
                sr.id,
                sr.serialnumber,
                sr.computername,
                sr.model,
                sr.ram_gb,
                sr.operatingsystem as operating_system,
                sr.cpu,
                sr.disks,
                sr.systemsku as system_sku,
                r.id as rma_id,
                r.store_id,
                r.record_id,
                r.reason,
                r.notes,
                r.rma_date,
                r.store_status,
                r.inventory_status,
                r.location_type,
                r.received_at,
                r.processed_at,
                r.completed_at,
                r.failed_at,
                r.failed_reason,
                s.name as store_name
            FROM store_rma r
            LEFT JOIN system_records sr ON r.record_id = sr.id
            LEFT JOIN stores s ON r.store_id = s.id
            WHERE r.location_type = 'inventory'
            AND sr.serialnumber = $1
        `;
        
        const result = await client.query(query, [serialNumber]);
        
        res.json({
            success: true,
            rma_items: result.rows
        });
    } catch (error) {
        console.error('Error searching RMA items:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

// Delete RMA item
router.delete('/:rmaId', auth, checkRole(['admin']), async (req, res) => {
    let client;
    const { rmaId } = req.params;
    
    try {
        client = await pool.connect();
        
        await client.query('BEGIN');

        // Check if RMA exists and is in inventory
        const checkResult = await client.query(`
            SELECT id, inventory_status 
            FROM store_rma 
            WHERE id = $1 AND location_type = 'inventory'
        `, [rmaId]);

        if (checkResult.rows.length === 0) {
            throw new Error('RMA item not found');
        }

        // Delete RMA
        const result = await client.query(`
            DELETE FROM store_rma
            WHERE id = $1
            RETURNING *
        `, [rmaId]);

        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'RMA item deleted successfully'
        });
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error deleting RMA:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        if (client) {
            client.release();
        }
    }
});

module.exports = router; 