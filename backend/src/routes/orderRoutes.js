const express = require('express');
const router = express.Router();
const pool = require('../db');
const { auth, checkGroup } = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/checkPermission');
const { catchAsync } = require('../middleware/errorHandler');
const { ValidationError, NotFoundError, AuthorizationError } = require('../middleware/errorTypes');

console.log('Loading orderRoutes module...');

// Get store orders
router.get('/:storeId', auth, checkStorePermission('orders'), catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const client = await pool.connect();
    
    try {
        // Add is_deleted column if it doesn't exist
        try {
            await client.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (
                        SELECT 1 
                        FROM information_schema.columns 
                        WHERE table_name = 'store_order_items' 
                        AND column_name = 'is_deleted'
                    ) THEN 
                        ALTER TABLE store_order_items 
                        ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
                    END IF;
                END $$;
            `);
            console.log('Checked/Added is_deleted column');
        } catch (migrationError) {
            console.error('Migration error:', migrationError);
            // Continue even if migration fails
        }

        console.log('Fetching orders for store:', storeId);
        
        // Clean up redundant pending orders
        const cleanupQuery = `
            WITH latest_pending AS (
                SELECT id
                FROM store_orders
                WHERE store_id = $1 AND status = 'pending'
                ORDER BY created_at DESC
                LIMIT 1
            ),
            redundant_orders AS (
                SELECT o.id
                FROM store_orders o
                LEFT JOIN store_order_items oi ON o.id = oi.order_id
                WHERE o.store_id = $1 
                AND o.status = 'pending'
                AND o.id NOT IN (SELECT id FROM latest_pending)
                GROUP BY o.id
            )
            DELETE FROM store_orders
            WHERE id IN (SELECT id FROM redundant_orders)
            RETURNING id;
        `;
        
        try {
            const cleanupResult = await client.query(cleanupQuery, [storeId]);
            if (cleanupResult.rows.length > 0) {
                console.log('Cleaned up redundant pending orders:', cleanupResult.rows.map(row => row.id));
            }
        } catch (cleanupError) {
            console.error('Error during cleanup:', cleanupError);
            // Continue even if cleanup fails
        }

        // First, get pending order details
        const pendingOrderQuery = `
            SELECT 
                o.id as order_id,
                o.status,
                o.created_at,
                COUNT(oi.id) as item_count,
                json_agg(
                    json_build_object(
                        'id', oi.id,
                        'record_id', oi.record_id,
                        'serialnumber', sr.serialnumber,
                        'model', sr.model
                    )
                ) as items
            FROM store_orders o
            LEFT JOIN store_order_items oi ON o.id = oi.order_id
            LEFT JOIN system_records sr ON oi.record_id = sr.id
            WHERE o.store_id = $1 AND o.status = 'pending'
            GROUP BY o.id, o.status, o.created_at;
        `;
        
        const pendingResult = await client.query(pendingOrderQuery, [storeId]);
        console.log('Pending order details:', {
            found: pendingResult.rows.length > 0,
            order: pendingResult.rows[0],
            itemCount: pendingResult.rows[0]?.item_count,
            items: pendingResult.rows[0]?.items
        });

        // Then get all orders with items
        const query = `
            WITH order_items_count AS (
                SELECT 
                    order_id,
                    COUNT(*) as total_items,
                    COUNT(*) FILTER (WHERE NOT is_deleted) as active_items
                FROM store_order_items
                GROUP BY order_id
            )
            SELECT 
                o.id as order_id,
                o.status,
                o.created_at,
                COALESCE(
                    json_agg(
                        CASE WHEN oi.id IS NOT NULL THEN
                            json_build_object(
                                'id', oi.id,
                                'record_id', oi.record_id,
                                'serialnumber', sr.serialnumber,
                                'computername', sr.computername,
                                'model', sr.model,
                                'system_sku', sr.systemsku,
                                'operating_system', sr.operatingsystem,
                                'cpu', sr.cpu,
                                'ram_gb', sr.ram_gb,
                                'disks', sr.disks,
                                'price', oi.price,
                                'notes', oi.notes,
                                'is_deleted', oi.is_deleted,
                                'order', json_build_object(
                                    'id', o.id,
                                    'status', o.status,
                                    'items_count', COALESCE(oic.active_items, 0),
                                    'total_items', COALESCE(oic.total_items, 0)
                                )
                            )
                        ELSE NULL END
                    ) FILTER (WHERE oi.id IS NOT NULL),
                    '[]'::json
                ) as items
            FROM store_orders o
            LEFT JOIN store_order_items oi ON o.id = oi.order_id
            LEFT JOIN system_records sr ON oi.record_id = sr.id
            LEFT JOIN order_items_count oic ON o.id = oic.order_id
            WHERE o.store_id = $1
            GROUP BY o.id, o.status, o.created_at, oic.total_items, oic.active_items
            ORDER BY 
                CASE WHEN o.status = 'pending' THEN 0 ELSE 1 END,
                o.created_at DESC;
        `;
        
        console.log('Executing query with storeId:', storeId);
        const result = await client.query(query, [storeId]);
        console.log('Query executed successfully, row count:', result.rows.length);
        
        // Log each order's details
        result.rows.forEach(row => {
            console.log(`Order #${row.order_id} details:`, {
                status: row.status,
                itemCount: Array.isArray(row.items) ? row.items.length : 0,
                items: row.items
            });
        });
        
        const orders = result.rows.map(row => ({
            order_id: row.order_id,
            status: row.status,
            created_at: row.created_at,
            items: row.items || []
        }));

        console.log('Sending response with orders count:', orders.length);
        res.json({
            success: true,
            orders
        });
    } catch (error) {
        console.error('Error fetching store orders:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: error.message,
            details: error.stack
        });
    } finally {
        client.release();
    }
}));

// Add items to order
router.post('/:storeId', auth, checkStorePermission('orders'), catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const { items } = req.body;
    const client = await pool.connect();
    
    try {
        // Remove unique constraint if it exists
        try {
            await client.query(`
                DO $$ 
                BEGIN 
                    IF EXISTS (
                        SELECT 1 
                        FROM pg_constraint 
                        WHERE conname = 'store_order_items_record_id_key'
                    ) THEN 
                        ALTER TABLE store_order_items 
                        DROP CONSTRAINT store_order_items_record_id_key;
                    END IF;
                END $$;
            `);
            console.log('Checked/Removed record_id unique constraint');
        } catch (migrationError) {
            console.error('Migration error:', migrationError);
            // Continue even if migration fails
        }

        // Validate items array
        if (!items) {
            throw new ValidationError('Items array is required');
        }
        if (!Array.isArray(items)) {
            throw new ValidationError('Items must be an array');
        }
        if (items.length === 0) {
            throw new ValidationError('At least one item is required');
        }

        await client.query('BEGIN');

        // First check if there's an existing pending order
        const pendingOrderQuery = await client.query(`
            SELECT id 
            FROM store_orders 
            WHERE store_id = $1 AND status = 'pending'
            ORDER BY created_at DESC
            LIMIT 1
        `, [storeId]);

        let orderId;
        if (pendingOrderQuery.rows.length > 0) {
            orderId = pendingOrderQuery.rows[0].id;
            console.log('Using existing pending order:', orderId);
        } else {
            // Create new order if no pending order exists
            const orderResult = await client.query(`
                INSERT INTO store_orders (store_id, status)
                VALUES ($1, 'pending')
                RETURNING id
            `, [storeId]).catch(err => {
                console.error('Database error creating new order:', err);
                throw new Error('Failed to create new order');
            });
            
            orderId = orderResult.rows[0].id;
            console.log('Created new pending order:', orderId);
        }

        // First check if any items are in pending orders (except our target order)
        for (const item of items) {
            if (!item.recordId) {
                throw new ValidationError('Each item must have a recordId');
            }

            // Check if item exists in any order (pending or completed)
            const orderCheck = await client.query(`
                SELECT 
                    o.id as order_id, 
                    o.status, 
                    oi.id as item_id,
                    oi.is_deleted
                FROM store_order_items oi 
                JOIN store_orders o ON oi.order_id = o.id 
                WHERE oi.record_id = $1 
                AND (oi.is_deleted IS NULL OR NOT oi.is_deleted)
                ORDER BY o.status = 'pending' DESC
                LIMIT 1
            `, [item.recordId]).catch(err => {
                console.error('Database error checking orders:', err);
                throw new Error(`Failed to check if item ${item.recordId} is in orders`);
            });

            if (orderCheck.rows.length > 0) {
                const { status, order_id, item_id, is_deleted } = orderCheck.rows[0];
                
                if (status === 'pending') {
                    throw new ValidationError(`Item ${item.recordId} already exists in another pending order`);
                }
                
                // If item is in completed order and not already deleted, mark it as deleted
                if (status === 'completed' && !is_deleted) {
                    console.log(`Item ${item.recordId} exists in completed order ${order_id}, marking as deleted`);
                    
                    // Mark the item as deleted in the old order
                    await client.query(`
                        UPDATE store_order_items 
                        SET is_deleted = true
                        WHERE id = $1
                    `, [item_id]).catch(err => {
                        console.error('Database error marking item as deleted:', err);
                        throw new Error(`Failed to mark item ${item.recordId} as deleted in old order`);
                    });
                }
            }
        }

        // Add items to the order
        for (const item of items) {
            // Check if item exists in store
            const storeItemCheck = await client.query(
                'SELECT id FROM store_items WHERE store_id = $1 AND record_id = $2',
                [storeId, item.recordId]
            ).catch(err => {
                console.error('Database error checking store item:', err);
                throw new Error(`Failed to check item ${item.recordId} in store`);
            });
            
            if (storeItemCheck.rows.length === 0) {
                throw new NotFoundError(`Item with recordId ${item.recordId} not found in store`);
            }

            // Add to order_items
            await client.query(`
                INSERT INTO store_order_items (order_id, record_id, notes)
                VALUES ($1, $2, $3)
            `, [orderId, item.recordId, item.notes || null]).catch(err => {
                console.error('Database error adding item to order:', err);
                throw new Error(`Failed to add item ${item.recordId} to order`);
            });
            
            // Remove from store_items
            await client.query(
                'DELETE FROM store_items WHERE store_id = $1 AND record_id = $2',
                [storeId, item.recordId]
            ).catch(err => {
                console.error('Database error removing item from store:', err);
                throw new Error(`Failed to remove item ${item.recordId} from store`);
            });
        }
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            orderId
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding to order:', error);
        
        // Send appropriate error status based on error type
        if (error instanceof ValidationError) {
            res.status(400).json({
                success: false,
                error: error.message
            });
        } else if (error instanceof NotFoundError) {
            res.status(404).json({
                success: false,
                error: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                error: error.message || 'An error occurred while adding items to order'
            });
        }
    } finally {
        client.release();
    }
}));

// Save order (change status from pending to completed)
router.put('/:storeId/:orderId/save', auth, checkStorePermission('orders'), catchAsync(async (req, res) => {
    const { storeId, orderId } = req.params;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Update order status
        const result = await client.query(`
            UPDATE store_orders
            SET status = 'completed'
            WHERE id = $1 AND store_id = $2 AND status = 'pending'
            RETURNING id
        `, [orderId, storeId]);

        if (result.rows.length === 0) {
            throw new Error('Order not found or already completed');
        }

        await client.query('COMMIT');
        
        res.json({
            success: true,
            orderId
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error saving order:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
}));

// Delete order item
router.delete('/:storeId/items/:itemId', auth, checkStorePermission('orders'), catchAsync(async (req, res) => {
    const { storeId, itemId } = req.params;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 獲取要刪除的項目詳細信息
        const itemResult = await client.query(`
            SELECT 
                oi.id as item_id,
                oi.record_id,
                o.id as order_id,
                o.store_id,
                o.status
            FROM store_order_items oi
            JOIN store_orders o ON oi.order_id = o.id
            WHERE oi.id = $1 
            AND o.store_id = $2
        `, [itemId, storeId]);

        if (itemResult.rows.length === 0) {
            throw new Error('Item not found');
        }

        const item = itemResult.rows[0];

        // 檢查 order 是否為 pending
        if (item.status !== 'pending') {
            throw new Error('Cannot delete item from a completed order');
        }

        // 將項目返回到 store_items
        await client.query(`
            INSERT INTO store_items (store_id, record_id)
            VALUES ($1, $2)
            RETURNING id
        `, [storeId, item.record_id]);

        // 刪除 pending order 中的項目
        await client.query('DELETE FROM store_order_items WHERE id = $1', [itemId]);

        // 重要：將 completed orders 中對應的項目標記為未刪除
        await client.query(`
            UPDATE store_order_items oi
            SET is_deleted = false
            FROM store_orders o
            WHERE oi.order_id = o.id
            AND o.store_id = $1
            AND o.status = 'completed'
            AND oi.record_id = $2
        `, [storeId, item.record_id]);

        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Item deleted successfully and restored in completed orders',
            itemId: itemResult.rows[0].id
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting order item:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
}));

// Update order item notes
router.put('/:storeId/items/:itemId/notes', auth, checkStorePermission('orders'), catchAsync(async (req, res) => {
    const { storeId, itemId } = req.params;
    const { notes } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Check if item exists and belongs to a pending order
        const itemResult = await client.query(`
            SELECT oi.id
            FROM store_order_items oi
            JOIN store_orders o ON oi.order_id = o.id
            WHERE oi.id = $1 
            AND o.store_id = $2
            AND o.status = 'pending'
        `, [itemId, storeId]);

        if (itemResult.rows.length === 0) {
            throw new Error('Item not found or order is not pending');
        }

        // Update notes
        await client.query(`
            UPDATE store_order_items
            SET notes = $1
            WHERE id = $2
        `, [notes, itemId]);

        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Notes updated successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating notes:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
}));

// Update order item price
router.put('/:storeId/items/:itemId/price', auth, checkStorePermission('orders'), catchAsync(async (req, res) => {
    const { storeId, itemId } = req.params;
    const { price } = req.body;
    const client = await pool.connect();
    
    try {
        // Validate price
        if (price === undefined || price === null || isNaN(price) || parseFloat(price) <= 0) {
            throw new Error('Invalid price: Price must be a positive number');
        }

        await client.query('BEGIN');

        // Check if item exists and belongs to a pending order
        const itemResult = await client.query(`
            SELECT oi.id
            FROM store_order_items oi
            JOIN store_orders o ON oi.order_id = o.id
            WHERE oi.id = $1 
            AND o.store_id = $2
            AND o.status = 'pending'
        `, [itemId, storeId]);

        if (itemResult.rows.length === 0) {
            throw new Error('Item not found or order is not pending');
        }

        // Update price
        await client.query(`
            UPDATE store_order_items
            SET price = $1
            WHERE id = $2
        `, [parseFloat(price), itemId]);

        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Price updated successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating price:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
}));

// Delete order item from completed order
router.delete('/:storeId/completed/:orderId', auth, checkGroup(['admin']), catchAsync(async (req, res) => {
    const { storeId, orderId } = req.params;
    console.log('Delete order request received:', {
        storeId,
        orderId,
        url: req.originalUrl,
        method: req.method,
        headers: req.headers,
        path: req.path,
        baseUrl: req.baseUrl
    });
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 檢查 order 是否存在且屬於該商店
        const orderCheck = await client.query(`
            SELECT id 
            FROM store_orders 
            WHERE id = $1 AND store_id = $2 AND status = 'completed'
        `, [orderId, storeId]);

        if (orderCheck.rows.length === 0) {
            throw new Error('Order not found or not completed');
        }

        // 獲取所有 order items
        const itemsResult = await client.query(`
            SELECT id, record_id
            FROM store_order_items
            WHERE order_id = $1
        `, [orderId]);

        // 將所有 items 返回到 store_items
        for (const item of itemsResult.rows) {
            await client.query(`
                INSERT INTO store_items (store_id, record_id)
                VALUES ($1, $2)
            `, [storeId, item.record_id]);
        }

        // 刪除所有 order items
        await client.query('DELETE FROM store_order_items WHERE order_id = $1', [orderId]);

        // 刪除 order
        await client.query('DELETE FROM store_orders WHERE id = $1', [orderId]);

        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Order and all items deleted successfully',
            orderDeleted: true
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting order:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
}));

// Admin delete store order
router.delete('/stores/:storeId/orders/:orderId', auth, checkGroup(['admin']), catchAsync(async (req, res) => {
  const { storeId, orderId } = req.params;
  
  // 檢查訂單是否存在
  const order = await pool.query(
    'SELECT * FROM store_orders WHERE store_id = $1 AND id = $2',
    [storeId, orderId]
  );

  if (order.rows.length === 0) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Order not found'
      }
    });
  }

  // 刪除訂單
  await pool.query('BEGIN');
  try {
    // 先刪除訂單項目
    await pool.query(
      'DELETE FROM store_order_items WHERE order_id = $1',
      [orderId]
    );

    // 再刪除訂單本身
    await pool.query(
      'DELETE FROM store_orders WHERE id = $1',
      [orderId]
    );

    await pool.query('COMMIT');

    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}));

module.exports = router; 