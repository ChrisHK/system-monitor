const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all stores
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM stores ORDER BY name');
        res.json({ success: true, stores: result.rows });
    } catch (error) {
        console.error('Error fetching stores:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stores' });
    }
});

// Add a new store
router.post('/', async (req, res) => {
    const { name, address, phone, contact_person, email } = req.body;
    
    try {
        const result = await pool.query(
            'INSERT INTO stores (name, address, phone, contact_person, email, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, address, phone, contact_person, email, 'active']
        );
        res.json({ success: true, store: result.rows[0] });
    } catch (error) {
        console.error('Error creating store:', error);
        res.status(500).json({ success: false, error: 'Failed to create store' });
    }
});

// Update a store
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, address, phone, contact_person, email, status } = req.body;
    
    try {
        const result = await pool.query(
            'UPDATE stores SET name = $1, address = $2, phone = $3, contact_person = $4, email = $5, status = $6, updated_at = NOW() WHERE id = $7 RETURNING *',
            [name, address, phone, contact_person, email, status, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Store not found' });
        }
        
        res.json({ success: true, store: result.rows[0] });
    } catch (error) {
        console.error('Error updating store:', error);
        res.status(500).json({ success: false, error: 'Failed to update store' });
    }
});

// Delete a store
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        const result = await pool.query('DELETE FROM stores WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Store not found' });
        }
        
        res.json({ success: true, message: 'Store deleted successfully' });
    } catch (error) {
        console.error('Error deleting store:', error);
        res.status(500).json({ success: false, error: 'Failed to delete store' });
    }
});

// Get store items
router.get('/:storeId/items', async (req, res) => {
    const { storeId } = req.params;
    
    try {
        const query = `
            SELECT r.* 
            FROM store_items s
            JOIN system_records r ON s.record_id = r.id
            WHERE s.store_id = $1
            ORDER BY s.received_at DESC
        `;
        
        const result = await pool.query(query, [storeId]);
        
        res.json({
            success: true,
            items: result.rows
        });
    } catch (error) {
        console.error('Error fetching store items:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch store items'
        });
    }
});

// Process outbound items to store
router.post('/:storeId/outbound', async (req, res) => {
    const { storeId } = req.params;
    const { items } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Get outbound items
        const outboundItems = await client.query(
            'SELECT id, record_id FROM outbound_items WHERE id = ANY($1)',
            [items]
        );
        
        if (outboundItems.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'No outbound items found'
            });
        }
        
        // Add items to store
        for (const item of outboundItems.rows) {
            await client.query(
                'INSERT INTO store_items (store_id, record_id, received_at) VALUES ($1, $2, NOW())',
                [storeId, item.record_id]
            );
            
            // Mark outbound item as processed
            await client.query(
                'UPDATE outbound_items SET status = $1 WHERE id = $2',
                ['processed', item.id]
            );
        }
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Items processed successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing outbound items:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process outbound items'
        });
    } finally {
        client.release();
    }
});

module.exports = router; 