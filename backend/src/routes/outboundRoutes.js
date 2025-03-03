const express = require('express');
const router = express.Router();
const pool = require('../db');
const { auth } = require('../middleware/auth');
const { checkMainPermission } = require('../middleware/checkPermission');

// Get all outbound items
router.get('/items', auth, checkMainPermission('outbound'), async (req, res) => {
    try {
        const query = `
            SELECT o.id as outbound_item_id, o.notes, r.* 
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
router.post('/items', auth, checkMainPermission('outbound'), async (req, res) => {
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
router.delete('/items/:id', auth, checkMainPermission('outbound'), async (req, res) => {
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

        // 驗證目標商店是否存在
        const storeCheck = await client.query(
            'SELECT id, name FROM stores WHERE id = $1',
            [storeId]
        );

        if (storeCheck.rows.length === 0) {
            throw new Error('Target store not found');
        }

        // 驗證所有 outbound items 是否存在且狀態為 pending
        const outboundCheck = await client.query(`
            SELECT oi.id, oi.record_id, sr.serialnumber, si.store_id as source_store_id
            FROM outbound_items oi
            JOIN system_records sr ON oi.record_id = sr.id
            LEFT JOIN store_items si ON sr.id = si.record_id
            WHERE oi.id = ANY($1) AND oi.status = 'pending'
        `, [outbound_ids]);

        if (outboundCheck.rows.length !== outbound_ids.length) {
            throw new Error('Some outbound items not found or not in pending status');
        }

        // 從原始 store 刪除 items
        const recordIds = outboundCheck.rows.map(item => item.record_id);
        await client.query(
            'DELETE FROM store_items WHERE record_id = ANY($1)',
            [recordIds]
        );

        // 更新 outbound items 狀態
        await client.query(
            `UPDATE outbound_items 
            SET status = 'completed', 
                completed_at = CURRENT_TIMESTAMP,
                completed_by = $1
            WHERE id = ANY($2)`,
            [req.user.id, outbound_ids]
        );

        // 獲取 outbound items 的 notes
        const outboundItemsWithNotes = await client.query(
            `SELECT record_id, notes 
            FROM outbound_items 
            WHERE id = ANY($1)`,
            [outbound_ids]
        );

        // 將項目添加到目標商店庫存
        for (const item of outboundItemsWithNotes.rows) {
            await client.query(
                `INSERT INTO store_items (store_id, record_id, added_by, added_at, notes)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)`,
                [storeId, item.record_id, req.user.id, item.notes]
            );
        }

        // 更新 item_locations
        for (const item of outboundCheck.rows) {
            await client.query(`
                INSERT INTO item_locations (serialnumber, location, store_id, store_name, updated_at)
                VALUES ($1, 'store', $2, $3, CURRENT_TIMESTAMP)
                ON CONFLICT (serialnumber) 
                DO UPDATE SET 
                    location = 'store',
                    store_id = EXCLUDED.store_id,
                    store_name = EXCLUDED.store_name,
                    updated_at = CURRENT_TIMESTAMP
            `, [item.serialnumber, storeId, storeCheck.rows[0].name]);

            // 記錄轉移歷史
            await client.query(`
                INSERT INTO item_transfer_history (
                    serialnumber,
                    source_store_id,
                    target_store_id,
                    transfer_type,
                    transferred_by,
                    transferred_at
                ) VALUES ($1, $2, $3, 'store_transfer', $4, CURRENT_TIMESTAMP)
            `, [item.serialnumber, item.source_store_id, storeId, req.user.id]);
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Items transferred to store successfully',
            sent_items: outbound_ids.length
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error transferring items to store:', error);
        res.status(error.message.includes('not found') ? 404 : 500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});

// Update outbound item notes
router.put('/items/:itemId/notes', auth, checkMainPermission('outbound'), async (req, res) => {
    const { itemId } = req.params;
    const { notes } = req.body;
    
    try {
        // Check if item exists and get its status
        const checkResult = await pool.query(
            'SELECT id, status FROM outbound_items WHERE id = $1',
            [itemId]
        );
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Outbound item not found'
            });
        }

        const item = checkResult.rows[0];
        if (item.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: `Cannot update notes for item with status: ${item.status}`
            });
        }

        // Update notes
        await pool.query(
            'UPDATE outbound_items SET notes = $1 WHERE id = $2',
            [notes, itemId]
        );
        
        res.json({
            success: true,
            message: 'Notes updated successfully'
        });
    } catch (error) {
        console.error('Error updating outbound item notes:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update notes'
        });
    }
});

module.exports = router; 