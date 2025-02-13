const express = require('express');
const router = express.Router();
const pool = require('../db');
const { auth, checkRole } = require('../middleware/auth');

// Get store sales
router.get('/:storeId', auth, async (req, res) => {
    const { storeId } = req.params;
    const client = await pool.connect();
    
    try {
        const query = `
            SELECT ss.*, sr.*, s.name as store_name
            FROM store_sales ss
            JOIN system_records sr ON ss.record_id = sr.id
            JOIN stores s ON ss.store_id = s.id
            WHERE ss.store_id = $1
            ORDER BY ss.sale_date DESC
        `;
        
        const result = await client.query(query, [storeId]);
        
        res.json({
            success: true,
            sales: result.rows
        });
    } catch (error) {
        console.error('Error fetching store sales:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});

// Add item to sales
router.post('/:storeId', auth, async (req, res) => {
    const { storeId } = req.params;
    const { recordId, price, notes } = req.body;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if item exists in store
        const storeCheck = await client.query(
            'SELECT id FROM store_items WHERE store_id = $1 AND record_id = $2',
            [storeId, recordId]
        );
        
        if (storeCheck.rows.length === 0) {
            throw new Error('Item not found in this store');
        }
        
        // Add to sales
        const result = await client.query(`
            INSERT INTO store_sales (store_id, record_id, price, notes)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [storeId, recordId, price, notes]);
        
        // Remove from store_items
        await client.query(
            'DELETE FROM store_items WHERE store_id = $1 AND record_id = $2',
            [storeId, recordId]
        );
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            sale: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding to sales:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});

// Search sales by serial number
router.get('/:storeId/search/:serialNumber', auth, async (req, res) => {
    const { storeId, serialNumber } = req.params;
    const client = await pool.connect();
    
    try {
        const query = `
            SELECT ss.*, sr.*, s.name as store_name
            FROM store_sales ss
            JOIN system_records sr ON ss.record_id = sr.id
            JOIN stores s ON ss.store_id = s.id
            WHERE ss.store_id = $1 AND sr.serialnumber = $2
        `;
        
        const result = await client.query(query, [storeId, serialNumber]);
        
        res.json({
            success: true,
            sale: result.rows[0]
        });
    } catch (error) {
        console.error('Error searching sales:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});

module.exports = router; 