const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all outbound items
router.get('/items', async (req, res) => {
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
router.post('/items', async (req, res) => {
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
router.delete('/items/:id', async (req, res) => {
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

module.exports = router; 