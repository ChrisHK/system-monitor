const express = require('express');
const router = express.Router();
const pool = require('../db');
const { auth, checkRole } = require('../middleware/auth');

console.log('RMA Routes module loaded');

// Wrap the entire route handler in a try-catch to catch any initialization errors
try {
    // Get store RMA items
    router.get('/:storeId', auth, async (req, res) => {
        let client;
        const { storeId } = req.params;
        
        console.log('=== Starting RMA items fetch ===');
        console.log('Store ID:', storeId);
        console.log('Request headers:', req.headers);
        
        try {
            // Test database connection first
            try {
                console.log('Testing database connection...');
                await pool.query('SELECT 1');
                console.log('Database connection test successful');
            } catch (dbError) {
                console.error('Database connection test failed:', dbError);
                throw new Error('Database connection failed');
            }

            if (!storeId || isNaN(storeId)) {
                console.log('Invalid store ID detected:', storeId);
                throw new Error('Invalid store ID');
            }

            console.log('Attempting to connect to database pool...');
            client = await pool.connect();
            console.log('Database client acquired successfully');

            // First check if store exists
            console.log('Checking if store exists...');
            const storeCheck = await client.query('SELECT id FROM stores WHERE id = $1', [storeId]);
            console.log('Store check result:', storeCheck.rows);
            
            if (storeCheck.rows.length === 0) {
                console.log('Store not found:', storeId);
                throw new Error(`Store with ID ${storeId} not found`);
            }
            console.log('Store exists, proceeding with RMA query');

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
                WHERE r.store_id = $1
                ORDER BY r.rma_date DESC
            `;
            
            console.log('Executing RMA query with params:', [storeId]);
            console.log('Query:', query);
            
            const result = await client.query(query, [storeId]);
            console.log('Query completed successfully');
            console.log('Rows returned:', result.rows.length);
            if (result.rows.length > 0) {
                console.log('First row sample:', result.rows[0]);
            } else {
                console.log('No RMA items found for store');
            }
            
            res.json({
                success: true,
                rma_items: result.rows
            });
            console.log('=== RMA fetch completed successfully ===');
        } catch (error) {
            console.error('=== Error in RMA fetch ===');
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                code: error.code,
                detail: error.detail,
                storeId: storeId,
                query: error.query,
                name: error.name,
                where: error.where
            });

            // Send appropriate status code based on error type
            const statusCode = error.message.includes('not found') ? 404 : 500;
            
            res.status(statusCode).json({
                success: false,
                error: error.message,
                detail: error.detail || 'No additional details available'
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

    // Add item to RMA
    router.post('/:storeId', auth, async (req, res) => {
        const { storeId } = req.params;
        const { recordId, reason, notes } = req.body;
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Check if item exists in completed orders
            const orderCheck = await client.query(`
                SELECT soi.id 
                FROM store_order_items soi
                JOIN store_orders so ON soi.order_id = so.id
                WHERE so.store_id = $1 
                AND soi.record_id = $2
                AND so.status = 'completed'
            `, [storeId, recordId]);
            
            if (orderCheck.rows.length === 0) {
                throw new Error('Item not found in completed orders');
            }
            
            // Add to RMA
            const result = await client.query(`
                INSERT INTO store_rma (store_id, record_id, reason, notes)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [storeId, recordId, reason, notes]);
            
            await client.query('COMMIT');
            
            res.json({
                success: true,
                rma: result.rows[0]
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error adding to RMA:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            client.release();
        }
    });

    // Search RMA by serial number
    router.get('/:storeId/search/:serialNumber', auth, async (req, res) => {
        const { storeId, serialNumber } = req.params;
        const client = await pool.connect();
        
        try {
            const query = `
                SELECT r.*, sr.*, s.name as store_name
                FROM store_rma r
                JOIN system_records sr ON r.record_id = sr.id
                JOIN stores s ON r.store_id = s.id
                WHERE r.store_id = $1 AND sr.serialnumber = $2
            `;
            
            const result = await client.query(query, [storeId, serialNumber]);
            
            res.json({
                success: true,
                rma: result.rows[0]
            });
        } catch (error) {
            console.error('Error searching RMA:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            client.release();
        }
    });

    // Update RMA status
    router.put('/:storeId/:rmaId/status', auth, async (req, res) => {
        const { storeId, rmaId } = req.params;
        const { status } = req.body;
        const client = await pool.connect();
        
        try {
            const result = await client.query(`
                UPDATE store_rma
                SET status = $1
                WHERE id = $2 AND store_id = $3
                RETURNING *
            `, [status, rmaId, storeId]);
            
            if (result.rows.length === 0) {
                throw new Error('RMA item not found');
            }
            
            res.json({
                success: true,
                rma: result.rows[0]
            });
        } catch (error) {
            console.error('Error updating RMA status:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            client.release();
        }
    });

    // Update RMA fields
    router.put('/:storeId/:rmaId/fields', auth, async (req, res) => {
        const { storeId, rmaId } = req.params;
        const { reason, notes } = req.body;
        const client = await pool.connect();
        
        try {
            // Validate reason is not empty
            if (!reason || reason.trim() === '') {
                throw new Error('Reason cannot be empty');
            }
            
            const result = await client.query(`
                UPDATE store_rma
                SET reason = $1, notes = $2
                WHERE id = $3 AND store_id = $4
                RETURNING *
            `, [reason, notes, rmaId, storeId]);
            
            if (result.rows.length === 0) {
                throw new Error('RMA item not found');
            }
            
            res.json({
                success: true,
                rma: result.rows[0]
            });
        } catch (error) {
            console.error('Error updating RMA fields:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            client.release();
        }
    });

    // Delete RMA item
    router.delete('/:storeId/:rmaId', auth, async (req, res) => {
        const { storeId, rmaId } = req.params;
        const client = await pool.connect();
        
        try {
            const result = await client.query(`
                DELETE FROM store_rma
                WHERE id = $1 AND store_id = $2
                RETURNING *
            `, [rmaId, storeId]);
            
            if (result.rows.length === 0) {
                throw new Error('RMA item not found');
            }
            
            res.json({
                success: true,
                message: 'RMA item deleted successfully'
            });
        } catch (error) {
            console.error('Error deleting RMA:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            client.release();
        }
    });

    // Send to Inventory
    router.put('/:storeId/:rmaId/send-to-inventory', auth, async (req, res) => {
        const { storeId, rmaId } = req.params;
        const client = await pool.connect();
        
        try {
            console.log('=== Starting Send to Inventory ===');
            console.log('Params:', { storeId, rmaId });

            await client.query('BEGIN');

            // 檢查RMA項目是否存在
            const checkResult = await client.query(`
                SELECT id, store_status, location_type, inventory_status
                FROM store_rma 
                WHERE id = $1 AND store_id = $2
            `, [rmaId, storeId]);

            console.log('Check result:', checkResult.rows[0]);

            if (checkResult.rows.length === 0) {
                throw new Error('RMA item not found');
            }

            // 更新RMA狀態
            const result = await client.query(`
                UPDATE store_rma
                SET 
                    store_status = 'sent_to_inventory'::rma_store_status,
                    inventory_status = 'receive'::rma_inventory_status,
                    location_type = 'inventory',
                    received_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND store_id = $2
                RETURNING *
            `, [rmaId, storeId]);

            console.log('Update result:', result.rows[0]);

            await client.query('COMMIT');
            
            res.json({
                success: true,
                rma: result.rows[0]
            });

            console.log('=== Send to Inventory completed successfully ===');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error sending to inventory:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            client.release();
        }
    });

    // Send RMA item back to store inventory
    router.put('/:storeId/:rmaId/send-to-store', auth, async (req, res) => {
        const { storeId, rmaId } = req.params;
        const client = await pool.connect();

        try {
            console.log('=== Starting Send to Store ===');
            console.log('Params:', { storeId, rmaId });

            await client.query('BEGIN');

            // Get RMA item details
            const rmaQuery = `
                SELECT r.*, sr.serialnumber, sr.model
                FROM store_rma r
                JOIN system_records sr ON r.record_id = sr.id
                WHERE r.store_id = $1 AND r.id = $2
            `;
            console.log('Executing RMA query:', rmaQuery);
            console.log('Query params:', [storeId, rmaId]);
            
            const rmaResult = await client.query(rmaQuery, [storeId, rmaId]);
            console.log('RMA query result:', rmaResult.rows);

            if (rmaResult.rows.length === 0) {
                throw new Error('RMA item not found');
            }

            const rmaItem = rmaResult.rows[0];
            console.log('RMA item found:', rmaItem);

            // Check if the item is in completed status
            console.log('Current store_status:', rmaItem.store_status);
            if (rmaItem.store_status !== 'completed') {
                throw new Error('Only completed RMA items can be sent back to store inventory');
            }

            // Check if item already exists in store_items
            console.log('Checking if item exists in store_items...');
            const existingItem = await client.query(
                'SELECT id FROM store_items WHERE store_id = $1 AND record_id = $2',
                [storeId, rmaItem.record_id]
            );
            console.log('Existing item check result:', existingItem.rows);

            if (existingItem.rows.length > 0) {
                throw new Error('Item already exists in store inventory');
            }

            // Insert into store_items
            console.log('Inserting into store_items...');
            const insertResult = await client.query(
                'INSERT INTO store_items (store_id, record_id, received_at) VALUES ($1, $2, NOW()) RETURNING *',
                [storeId, rmaItem.record_id]
            );
            console.log('Insert result:', insertResult.rows[0]);

            // Update RMA status
            console.log('Updating RMA status...');
            const updateResult = await client.query(`
                UPDATE store_rma 
                SET 
                    store_status = 'sent_to_store'::rma_store_status,
                    location_type = 'store',
                    last_updated = CURRENT_TIMESTAMP
                WHERE id = $1 
                RETURNING *
            `, [rmaId]);
            console.log('Update result:', updateResult.rows[0]);

            // Update item location
            console.log('Updating item location...');
            const locationResult = await client.query(`
                UPDATE item_locations 
                SET location = 'store', 
                    store_id = $1,
                    updated_at = NOW()
                WHERE serialnumber = $2
                RETURNING *
            `, [storeId, rmaItem.serialnumber]);
            console.log('Location update result:', locationResult.rows[0]);

            await client.query('COMMIT');
            console.log('=== Send to Store completed successfully ===');

            res.json({
                success: true,
                message: 'RMA item sent back to store inventory successfully'
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error sending RMA to store:', error);
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                code: error.code,
                detail: error.detail,
                hint: error.hint,
                position: error.position,
                internalPosition: error.internalPosition,
                internalQuery: error.internalQuery,
                where: error.where,
                schema: error.schema,
                table: error.table,
                column: error.column,
                dataType: error.dataType,
                constraint: error.constraint
            });
            res.status(500).json({
                success: false,
                error: error.message
            });
        } finally {
            client.release();
        }
    });
} catch (error) {
    console.error('Error initializing RMA routes:', error);
    throw error;
}

module.exports = router; 