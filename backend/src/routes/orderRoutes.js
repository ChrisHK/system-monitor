const express = require('express');
const router = express.Router();
const pool = require('../db');
const { auth, checkRole } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');
const { ValidationError, NotFoundError, AuthorizationError } = require('../middleware/errorTypes');

// Get store orders
router.get('/:storeId', auth, async (req, res) => {
    const { storeId } = req.params;
    const client = await pool.connect();
    
    try {
        const query = `
            SELECT 
                o.id as order_id,
                o.status,
                o.created_at,
                oi.id as item_id,
                oi.record_id,
                sr.serialnumber,
                sr.computername,
                sr.model,
                sr.systemsku,
                sr.operatingsystem,
                sr.cpu,
                sr.ram_gb,
                sr.disks,
                oi.price,
                oi.notes
            FROM store_orders o
            LEFT JOIN store_order_items oi ON o.id = oi.order_id
            LEFT JOIN system_records sr ON oi.record_id = sr.id
            WHERE o.store_id = $1
            ORDER BY o.created_at DESC
        `;
        
        const result = await client.query(query, [storeId]);
        
        const orders = result.rows.map(row => ({
            order_id: row.order_id,
            status: row.status,
            created_at: row.created_at,
            id: row.item_id,
            record_id: row.record_id,
            serialnumber: row.serialnumber,
            computername: row.computername,
            model: row.model,
            system_sku: row.systemsku,
            operating_system: row.operatingsystem,
            cpu: row.cpu,
            ram: row.ram_gb,
            disks: row.disks,
            price: row.price,
            notes: row.notes
        }));

        res.json({
            success: true,
            orders
        });
    } catch (error) {
        console.error('Error fetching store orders:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});

// Add items to order
router.post('/:storeId', auth, async (req, res) => {
    const { storeId } = req.params;
    const { items } = req.body;
    const client = await pool.connect();
    
    try {
        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new Error('No items provided');
        }

        await client.query('BEGIN');

        // Check if there's a pending order
        let orderId;
        const pendingOrderResult = await client.query(
            'SELECT id FROM store_orders WHERE store_id = $1 AND status = $2',
            [storeId, 'pending']
        );

        if (pendingOrderResult.rows.length > 0) {
            orderId = pendingOrderResult.rows[0].id;
        } else {
            // Create new order if no pending order exists
            const orderResult = await client.query(`
                INSERT INTO store_orders (store_id, status)
                VALUES ($1, 'pending')
                RETURNING id
            `, [storeId]);
            orderId = orderResult.rows[0].id;
        }

        // Verify and add items
        for (const item of items) {
            if (!item.recordId) {
                throw new Error('Invalid item data: recordId is required');
            }

            // Check if item exists in store
            const storeItemCheck = await client.query(
                'SELECT id FROM store_items WHERE store_id = $1 AND record_id = $2',
                [storeId, item.recordId]
            );
            
            if (storeItemCheck.rows.length === 0) {
                throw new Error(`Item ${item.recordId} not found in store`);
            }

            // Add to order_items
            await client.query(`
                INSERT INTO store_order_items (order_id, record_id, notes)
                VALUES ($1, $2, $3)
            `, [orderId, item.recordId, item.notes || null]);
            
            // Remove from store_items
            await client.query(
                'DELETE FROM store_items WHERE store_id = $1 AND record_id = $2',
                [storeId, item.recordId]
            );
        }
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            orderId
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding to order:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});

// Save order (change status from pending to completed)
router.put('/:storeId/:orderId/save', auth, async (req, res) => {
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
});

// Delete order item
router.delete('/:storeId/items/:itemId', auth, async (req, res) => {
    const { storeId, itemId } = req.params;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Get item details with a more specific query
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

        console.log('Delete item query result:', itemResult.rows);

        if (itemResult.rows.length === 0) {
            throw new Error('Item not found');
        }

        const item = itemResult.rows[0];

        // Check if the order is pending
        if (item.status !== 'pending') {
            throw new Error('Cannot delete item from a completed order');
        }

        // Return item to store_items
        await client.query(`
            INSERT INTO store_items (store_id, record_id)
            VALUES ($1, $2)
            RETURNING id
        `, [storeId, item.record_id]);

        // Delete from order_items
        const deleteResult = await client.query(
            'DELETE FROM store_order_items WHERE id = $1 RETURNING id', 
            [itemId]
        );

        console.log('Delete result:', deleteResult.rows);

        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Item deleted successfully',
            itemId: deleteResult.rows[0].id
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
});

// Update order item notes
router.put('/:storeId/items/:itemId/notes', auth, async (req, res) => {
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
});

// Update order item price
router.put('/:storeId/items/:itemId/price', auth, async (req, res) => {
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
});

// Delete order (admin only)
router.delete('/:storeId/:orderId', auth, checkRole(['admin']), catchAsync(async (req, res) => {
    const { storeId, orderId } = req.params;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Get order details and verify it exists
        const orderResult = await client.query(`
            SELECT o.*, oi.record_id
            FROM store_orders o
            LEFT JOIN store_order_items oi ON o.id = oi.order_id
            WHERE o.id = $1 AND o.store_id = $2
        `, [orderId, storeId]);

        if (orderResult.rows.length === 0) {
            throw new NotFoundError('Order not found');
        }

        // If order is completed, return items to store inventory
        if (orderResult.rows[0].status === 'completed') {
            for (const row of orderResult.rows) {
                if (row.record_id) {
                    await client.query(
                        'INSERT INTO store_items (store_id, record_id) VALUES ($1, $2)',
                        [storeId, row.record_id]
                    );
                }
            }
        }

        // Delete order items first
        await client.query('DELETE FROM store_order_items WHERE order_id = $1', [orderId]);
        
        // Then delete the order
        await client.query('DELETE FROM store_orders WHERE id = $1', [orderId]);

        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Order deleted successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}));

module.exports = router; 