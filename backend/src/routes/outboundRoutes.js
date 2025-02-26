const express = require('express');
const router = express.Router();
const pool = require('../db');
const { auth } = require('../middleware/auth');
const { checkMainPermission } = require('../middleware/checkPermission');

// Get all outbound items
router.get('/items', auth, async (req, res) => {
    try {
        const query = `
            SELECT o.id as outbound_item_id, r.* 
            FROM outbound_items o
            JOIN system_records r ON o.record_id = r.id
            WHERE o.status = 'pending'
            ORDER BY o.created_at DESC
        `;
        
        const result = await pool.query(query);
        
        res.json({
            success: true,
            items: result.rows
        });
    } catch (error) {
        console.error('Error fetching outbound items:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch outbound items'
        });
    }
});

// Add item to outbound
router.post('/items', auth, async (req, res) => {
    const { recordId } = req.body;
    
    try {
        // Check if record exists
        const checkRecord = await pool.query(
            'SELECT id FROM system_records WHERE id = $1',
            [recordId]
        );
        
        if (checkRecord.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Record not found'
            });
        }
        
        // Check if record is already in outbound
        const checkOutbound = await pool.query(
            'SELECT id FROM outbound_items WHERE record_id = $1 AND status = $2',
            [recordId, 'pending']
        );
        
        if (checkOutbound.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Record already in outbound'
            });
        }
        
        // Add to outbound
        const result = await pool.query(
            'INSERT INTO outbound_items (record_id, status) VALUES ($1, $2) RETURNING id',
            [recordId, 'pending']
        );
        
        res.json({
            success: true,
            item: result.rows[0]
        });
    } catch (error) {
        console.error('Error adding outbound item:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add outbound item'
        });
    }
});

// Remove item from outbound
router.delete('/items/:id', auth, async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await pool.query(
            'DELETE FROM outbound_items WHERE id = $1 RETURNING id',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Outbound item not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Item removed from outbound'
        });
    } catch (error) {
        console.error('Error removing outbound item:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove outbound item'
        });
    }
});

// Send items to store
router.post('/items/:storeId/send', auth, checkMainPermission('outbound'), async (req, res) => {
    const client = await pool.connect();
    const { storeId } = req.params;
    const { outbound_ids } = req.body;

    try {
        await client.query('BEGIN');

        // 驗證商店是否存在
        const storeCheck = await client.query(
            'SELECT id FROM stores WHERE id = $1',
            [storeId]
        );

        if (storeCheck.rows.length === 0) {
            throw new Error('Store not found');
        }

        // 驗證所有 outbound items 是否存在且狀態為 pending
        const outboundCheck = await client.query(
            `SELECT id, record_id 
            FROM outbound_items 
            WHERE id = ANY($1) AND status = 'pending'`,
            [outbound_ids]
        );

        if (outboundCheck.rows.length !== outbound_ids.length) {
            throw new Error('Some outbound items not found or not in pending status');
        }

        // 更新 outbound items 狀態
        await client.query(
            `UPDATE outbound_items 
            SET status = 'completed', 
                completed_at = CURRENT_TIMESTAMP,
                completed_by = $1
            WHERE id = ANY($2)`,
            [req.user.id, outbound_ids]
        );

        // 將項目添加到商店庫存
        const recordIds = outboundCheck.rows.map(row => row.record_id);
        await client.query(
            `INSERT INTO store_items (store_id, record_id, added_by, added_at)
            SELECT $1, id, $2, CURRENT_TIMESTAMP
            FROM system_records
            WHERE id = ANY($3)`,
            [storeId, req.user.id, recordIds]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Items sent to store successfully',
            sent_items: outbound_ids.length
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error sending items to store:', error);
        res.status(error.message.includes('not found') ? 404 : 500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});

module.exports = router; 