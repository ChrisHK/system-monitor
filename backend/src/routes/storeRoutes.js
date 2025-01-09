const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get all stores
router.get('/', async (req, res) => {
    try {
        console.log('=== GET /api/stores - Fetching all stores ===');
        const result = await pool.query('SELECT * FROM stores ORDER BY name');
        console.log('Found stores:', JSON.stringify(result.rows, null, 2));
        res.json({ success: true, stores: result.rows });
    } catch (error) {
        console.error('Error fetching stores:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: error.stack
        });
    }
});

// Create a new store
router.post('/', async (req, res) => {
    const { name, address, phone, email, description } = req.body;

    // Validate required fields
    if (!name || !address || !phone || !email) {
        return res.status(400).json({
            success: false,
            error: 'Name, address, phone, and email are required'
        });
    }

    try {
        const result = await pool.query(
            'INSERT INTO stores (name, address, phone, email, description) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, address, phone, email, description || null]
        );

        res.json({
            success: true,
            store: result.rows[0]
        });
    } catch (error) {
        console.error('Error creating store:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update a store
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { name, address, phone, email, description } = req.body;
    
    try {
        const result = await pool.query(
            'UPDATE stores SET name = $1, address = $2, phone = $3, email = $4, description = $5 WHERE id = $6 RETURNING *',
            [name, address, phone, email, description || null, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Store not found' });
        }
        
        res.json({ success: true, store: result.rows[0] });
    } catch (error) {
        console.error('Error updating store:', error);
        res.status(500).json({ success: false, error: error.message });
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
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get store items
router.get('/:storeId/items', async (req, res) => {
    const { storeId } = req.params;
    
    try {
        const query = `
            SELECT r.*, s.received_at 
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
        
        // Get record IDs and serial numbers
        const recordIds = outboundItems.rows.map(item => item.record_id);
        const recordsQuery = await client.query(
            'SELECT id, serialnumber FROM system_records WHERE id = ANY($1)',
            [recordIds]
        );
        
        // Remove items from their current stores
        await client.query(`
            DELETE FROM store_items 
            WHERE record_id = ANY($1)
        `, [recordIds]);
        
        // Add items to new store
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

// Delete a store item
router.delete('/:storeId/items/:itemId', async (req, res) => {
    const { storeId, itemId } = req.params;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if item exists in this store
        const checkItem = await client.query(
            'SELECT id FROM store_items WHERE store_id = $1 AND record_id = $2',
            [storeId, itemId]
        );
        
        if (checkItem.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Item not found in this store'
            });
        }
        
        // Delete the item
        await client.query(
            'DELETE FROM store_items WHERE store_id = $1 AND record_id = $2',
            [storeId, itemId]
        );
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Item deleted successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting store item:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete store item'
        });
    } finally {
        client.release();
    }
});

// Export store items as CSV
router.get('/:storeId/export', async (req, res) => {
    const { storeId } = req.params;
    
    try {
        // Get store name
        const storeResult = await pool.query('SELECT name FROM stores WHERE id = $1', [storeId]);
        if (storeResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Store not found'
            });
        }
        const storeName = storeResult.rows[0].name;

        // Get items with store information
        const query = `
            SELECT r.*, s.received_at 
            FROM store_items s
            JOIN system_records r ON s.record_id = r.id
            WHERE s.store_id = $1
            ORDER BY s.received_at DESC
        `;
        
        const result = await pool.query(query, [storeId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No items found'
            });
        }

        // Create CSV header
        const headers = [
            'Serial Number',
            'Computer Name',
            'Manufacturer',
            'Model',
            'System SKU',
            'Operating System',
            'CPU',
            'Resolution',
            'Graphics Card',
            'Touch Screen',
            'RAM (GB)',
            'Disks',
            'Design Capacity',
            'Full Charge',
            'Cycle Count',
            'Battery Health',
            'Received Time'
        ];

        // Create CSV content
        let csv = `Store: ${storeName}\n`;
        csv += `Total Items: ${result.rows.length}\n\n`;
        csv += headers.join(',') + '\n';

        // Add data rows
        result.rows.forEach(item => {
            const row = [
                item.serialnumber,
                item.computername,
                item.manufacturer,
                item.model,
                item.systemsku,
                item.operatingsystem,
                item.cpu,
                item.resolution,
                item.graphicscard,
                item.touchscreen ? 'Yes' : 'No',
                item.ram_gb,
                item.disks,
                item.design_capacity,
                item.full_charge_capacity,
                item.cycle_count,
                item.battery_health ? `${item.battery_health}%` : 'N/A',
                new Date(item.received_at).toLocaleString()
            ].map(value => `"${value || 'N/A'}"`); // Wrap in quotes and handle null values

            csv += row.join(',') + '\n';
        });

        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=store-items-${storeName}-${new Date().toISOString().split('T')[0]}.csv`);
        
        res.send(csv);
    } catch (error) {
        console.error('Error exporting store items:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export store items'
        });
    }
});

// Check for existing items in any store
router.post('/:storeId/check-items', async (req, res) => {
    const { items } = req.body;
    
    try {
        // Check if any items already exist in any store
        const duplicateQuery = `
            SELECT DISTINCT r.serialnumber, s.name as store_name
            FROM system_records r
            JOIN store_items si ON r.id = si.record_id
            JOIN stores s ON si.store_id = s.id
            WHERE r.serialnumber = ANY($1)
        `;
        
        const result = await pool.query(duplicateQuery, [items]);
        
        const duplicates = result.rows.map(row => ({
            serialNumber: row.serialnumber,
            storeName: row.store_name
        }));

        res.json({
            success: true,
            duplicates: duplicates
        });
    } catch (error) {
        console.error('Error checking store items:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Check for duplicate items in store
router.post('/:storeId/check', async (req, res) => {
    const { storeId } = req.params;
    const { serialNumbers } = req.body;
    const client = await pool.connect();
    
    try {
        // Check for existing items in the store
        const query = `
            SELECT DISTINCT r.serialnumber, s.name as store_name
            FROM system_records r
            JOIN store_items si ON r.id = si.record_id
            JOIN stores s ON si.store_id = s.id
            WHERE r.serialnumber = ANY($1)
        `;
        
        const result = await client.query(query, [serialNumbers]);
        
        res.json({
            success: true,
            duplicates: result.rows.map(row => ({
                serialNumber: row.serialnumber,
                storeName: row.store_name
            }))
        });
    } catch (error) {
        console.error('Error checking store items:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check store items'
        });
    } finally {
        client.release();
    }
});

module.exports = router; 