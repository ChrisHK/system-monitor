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

            // 改進 storeId 驗證
            const parsedStoreId = parseInt(storeId, 10);
            if (isNaN(parsedStoreId) || parsedStoreId <= 0) {
                console.log('Invalid store ID detected:', storeId);
                throw new Error(`Invalid store ID: ${storeId}`);
            }

            console.log('Attempting to connect to database pool...');
            client = await pool.connect();
            console.log('Database client acquired successfully');

            // First check if store exists
            console.log('Checking if store exists...');
            const storeCheck = await client.query('SELECT id FROM stores WHERE id = $1', [parsedStoreId]);
            console.log('Store check result:', storeCheck.rows);
            
            if (storeCheck.rows.length === 0) {
                console.log('Store not found:', parsedStoreId);
                throw new Error(`Store with ID ${parsedStoreId} not found`);
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
            
            console.log('Executing RMA query with params:', [parsedStoreId]);
            console.log('Query:', query);
            
            const result = await client.query(query, [parsedStoreId]);
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

    // Get single RMA item
    router.get('/:storeId/:rmaId', auth, async (req, res) => {
        const { storeId, rmaId } = req.params;
        const client = await pool.connect();
        
        try {
            console.log('=== Starting Single RMA fetch ===');
            console.log('Params:', { storeId, rmaId });

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
                WHERE r.store_id = $1 AND r.id = $2
            `;
            
            console.log('Executing RMA query with params:', [storeId, rmaId]);
            
            const result = await client.query(query, [storeId, rmaId]);
            
            if (result.rows.length === 0) {
                throw new Error('RMA item not found');
            }
            
            res.json({
                success: true,
                rma: result.rows[0]
            });
            
            console.log('=== Single RMA fetch completed successfully ===');
        } catch (error) {
            console.error('=== Error in Single RMA fetch ===');
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                code: error.code,
                detail: error.detail,
                storeId: storeId,
                rmaId: rmaId,
                query: error.query
            });

            const statusCode = error.message.includes('not found') ? 404 : 500;
            
            res.status(statusCode).json({
                success: false,
                error: error.message,
                detail: error.detail || 'No additional details available'
            });
        } finally {
            client.release();
        }
    });

    // Add item to RMA
    router.post('/:storeId', auth, async (req, res) => {
        const { storeId } = req.params;
        const { recordId, reason = '', notes = '' } = req.body;
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

            // 檢查RMA項目是否存在並獲取完整信息
            const checkResult = await client.query(`
                SELECT r.*, sr.serialnumber, sr.model, sr.manufacturer
                FROM store_rma r
                JOIN system_records sr ON r.record_id = sr.id
                WHERE r.id = $1 AND r.store_id = $2
            `, [rmaId, storeId]);

            console.log('Check result:', checkResult.rows[0]);

            if (checkResult.rows.length === 0) {
                throw new Error('RMA item not found');
            }

            const rmaItem = checkResult.rows[0];
            const currentStatus = rmaItem.store_status;
            if (currentStatus !== 'pending') {
                throw new Error(`Invalid status transition from ${currentStatus} to sent_to_inventory`);
            }

            // 更新 store_rma 狀態
            const updateStoreRma = await client.query(`
                UPDATE store_rma
                SET 
                    store_status = 'sent_to_inventory'::rma_store_status,
                    inventory_status = 'receive'::rma_inventory_status,
                    location_type = 'inventory',
                    received_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND store_id = $2
                RETURNING *
            `, [rmaId, storeId]);

            // 在 inventory_rma 中創建記錄
            const createInventoryRma = await client.query(`
                INSERT INTO inventory_rma (
                    store_rma_id,
                    store_id,
                    record_id,
                    serialnumber,
                    model,
                    manufacturer,
                    issue_description,
                    status,
                    created_at,
                    store_name
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, 'receive',
                    CURRENT_TIMESTAMP,
                    (SELECT name FROM stores WHERE id = $2)
                )
                RETURNING *
            `, [
                rmaId,
                storeId,
                rmaItem.record_id,
                rmaItem.serialnumber,
                rmaItem.model,
                rmaItem.manufacturer,
                rmaItem.reason
            ]);

            console.log('Created inventory RMA:', createInventoryRma.rows[0]);

            await client.query('COMMIT');
            
            res.json({
                success: true,
                rma: updateStoreRma.rows[0],
                inventoryRma: createInventoryRma.rows[0]
            });

            console.log('=== Send to Inventory completed successfully ===');
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error sending to inventory:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        } finally {
            client.release();
        }
    });

    // Send RMA item back to store
    router.put('/:storeId/:rmaId/send-to-store', auth, async (req, res) => {
        const { storeId, rmaId } = req.params;
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Check if RMA item exists and is completed
            const rmaResult = await client.query(`
                SELECT r.*, sr.serialnumber
                FROM store_rma r
                JOIN system_records sr ON r.record_id = sr.id
                WHERE r.id = $1 AND r.store_id = $2
            `, [rmaId, storeId]);

            if (rmaResult.rows.length === 0) {
                throw new Error('RMA item not found');
            }

            const rmaItem = rmaResult.rows[0];
            if (rmaItem.store_status !== 'completed') {
                throw new Error('RMA item must be completed before sending to store');
            }

            // Check if item already exists in store inventory
            const existingItemResult = await client.query(
                'SELECT * FROM store_items WHERE record_id = $1',
                [rmaItem.record_id]
            );

            if (existingItemResult.rows.length > 0) {
                throw new Error('Item already exists in store inventory');
            }

            // Insert item into store inventory
            await client.query(
                'INSERT INTO store_items (store_id, record_id, received_at) VALUES ($1, $2, NOW())',
                [storeId, rmaItem.record_id]
            );

            // Update RMA item status
            await client.query(
                'UPDATE store_rma SET store_status = $1 WHERE id = $2',
                ['sent_to_store', rmaId]
            );

            // Update item location
            await client.query(`
                INSERT INTO item_locations (serialnumber, location, store_id, store_name, updated_at)
                VALUES ($1, 'store', $2, (SELECT name FROM stores WHERE id = $2), NOW())
                ON CONFLICT (serialnumber) 
                DO UPDATE SET 
                    location = 'store',
                    store_id = EXCLUDED.store_id,
                    store_name = EXCLUDED.store_name,
                    updated_at = NOW()
            `, [rmaItem.serialnumber, storeId]);

            // Get updated store inventory
            const storeInventory = await client.query(`
                SELECT 
                    r.*,
                    s.received_at,
                    s.store_id,
                    st.name as store_name,
                    COALESCE(l.location, 'Store') as location
                FROM store_items s
                JOIN system_records r ON s.record_id = r.id
                JOIN stores st ON s.store_id = st.id
                LEFT JOIN item_locations l ON r.serialnumber = l.serialnumber
                WHERE s.store_id = $1
                ORDER BY s.received_at DESC
            `, [storeId]);

            await client.query('COMMIT');
            res.json({
                success: true,
                message: 'RMA item successfully sent to store',
                items: storeInventory.rows
            });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error sending RMA item to store:', error);
            res.status(400).json({ error: error.message });
        } finally {
            client.release();
        }
    });
} catch (error) {
    console.error('Error initializing RMA routes:', error);
    throw error;
}

module.exports = router; 