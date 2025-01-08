const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get all stores
router.get('/stores', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM stores ORDER BY name');
        res.json({ success: true, stores: result.rows });
    } catch (error) {
        console.error('Error fetching stores:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stores' });
    }
});

// Add a new store
router.post('/stores', async (req, res) => {
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
router.put('/stores/:id', async (req, res) => {
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
router.delete('/stores/:id', async (req, res) => {
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

// Send records to store
router.post('/store-outbound', async (req, res) => {
    const { storeId, recordIds } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Create new outbound record
        const outboundResult = await client.query(
            'INSERT INTO outbound (store_id, status, created_at) VALUES ($1, $2, NOW()) RETURNING id',
            [storeId, 'pending']
        );
        
        const outboundId = outboundResult.rows[0].id;
        
        // Add records to outbound_items
        for (const recordId of recordIds) {
            await client.query(
                'INSERT INTO outbound_items (outbound_id, record_id, status) VALUES ($1, $2, $3)',
                [outboundId, recordId, 'pending']
            );
        }
        
        await client.query('COMMIT');
        res.json({ success: true, outboundId });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error sending records to store:', error);
        res.status(500).json({ success: false, error: 'Failed to send records to store' });
    } finally {
        client.release();
    }
});

module.exports = router; 