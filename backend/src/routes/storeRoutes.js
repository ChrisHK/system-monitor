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
    const { itemIds, force = false } = req.body;
    const client = await pool.connect();
    
    try {
        console.log('=== POST /stores/:storeId/outbound - Processing outbound items ===');
        console.log('Request params:', { storeId, itemIds, force });

        if (!storeId || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
            console.log('Invalid request parameters:', { storeId, itemIds });
            return res.status(400).json({
                success: false,
                error: 'Invalid request parameters'
            });
        }

        await client.query('BEGIN');
        
        // Check if store exists
        console.log('Checking store existence:', storeId);
        const storeCheck = await client.query('SELECT id, name FROM stores WHERE id = $1', [storeId]);
        console.log('Store check result:', storeCheck.rows);
        
        if (storeCheck.rows.length === 0) {
            console.log('Store not found:', storeId);
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Store not found'
            });
        }
        
        // Get outbound items with more details
        console.log('Fetching outbound items:', itemIds);
        const outboundQuery = `
            SELECT o.id, o.record_id, o.status, r.serialnumber
            FROM outbound_items o
            JOIN system_records r ON r.id = o.record_id
            WHERE o.id = ANY($1) AND o.status = $2
        `;
        const outboundItems = await client.query(outboundQuery, [itemIds, 'pending']);
        console.log('Found outbound items:', outboundItems.rows);
        
        if (outboundItems.rows.length === 0) {
            console.log('No pending outbound items found for IDs:', itemIds);
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'No outbound items found'
            });
        }
        
        // Get record IDs and serial numbers
        const recordIds = outboundItems.rows.map(item => item.record_id);
        console.log('Fetching system records:', recordIds);
        const recordsQuery = await client.query(
            'SELECT id, serialnumber FROM system_records WHERE id = ANY($1)',
            [recordIds]
        );
        console.log('Found system records:', recordsQuery.rows);
        
        if (recordsQuery.rows.length === 0) {
            console.log('No system records found for record IDs:', recordIds);
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'No system records found for the outbound items'
            });
        }
        
        // Check if any items are already in any store
        console.log('Checking existing store assignments:', recordIds);
        const existingItems = await client.query(`
            SELECT si.record_id, s.name as store_name, r.serialnumber
            FROM store_items si
            JOIN stores s ON s.id = si.store_id
            JOIN system_records r ON r.id = si.record_id
            WHERE si.record_id = ANY($1)
        `, [recordIds]);
        console.log('Found existing store assignments:', existingItems.rows);
        
        if (existingItems.rows.length > 0 && !force) {
            const itemsInStores = existingItems.rows.map(item => 
                `Serial number ${item.serialnumber} is in store "${item.store_name}"`
            ).join(', ');
            
            console.log('Items already in stores:', itemsInStores);
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: `Some items are already in stores: ${itemsInStores}`
            });
        }
        
        // If force is true or no existing items, remove any existing store assignments
        if (existingItems.rows.length > 0) {
            console.log('Removing existing store assignments');
            await client.query(`
                DELETE FROM store_items 
                WHERE record_id = ANY($1)
            `, [recordIds]);
        }
        
        // Add items to new store
        try {
            console.log('Adding items to store:', {
                storeId,
                storeName: storeCheck.rows[0].name,
                items: outboundItems.rows.map(item => ({
                    id: item.id,
                    record_id: item.record_id,
                    serialnumber: item.serialnumber
                }))
            });

            for (const item of outboundItems.rows) {
                console.log('Processing item:', {
                    id: item.id,
                    record_id: item.record_id,
                    serialnumber: item.serialnumber
                });
                
                // Insert into store_items
                const insertResult = await client.query(
                    'INSERT INTO store_items (store_id, record_id, received_at) VALUES ($1, $2, NOW()) RETURNING id, store_id, record_id',
                    [storeId, item.record_id]
                );
                console.log('Inserted store item:', insertResult.rows[0]);
                
                // Update item location
                await client.query(`
                    INSERT INTO item_locations (serialnumber, location, store_id, store_name, updated_at)
                    VALUES ($1, 'store', $2, $3, NOW())
                    ON CONFLICT (serialnumber) 
                    DO UPDATE SET 
                        location = 'store',
                        store_id = EXCLUDED.store_id,
                        store_name = EXCLUDED.store_name,
                        updated_at = NOW()
                `, [item.serialnumber, storeId, storeCheck.rows[0].name]);
                console.log('Updated item location for:', item.serialnumber);
                
                // Mark outbound item as processed
                const updateResult = await client.query(
                    'UPDATE outbound_items SET status = $1, processed_at = NOW() WHERE id = $2 RETURNING id, status, processed_at',
                    ['processed', item.id]
                );
                console.log('Updated outbound item:', updateResult.rows[0]);
            }
        } catch (insertError) {
            console.error('Error inserting items:', insertError);
            console.error('Error details:', {
                code: insertError.code,
                message: insertError.message,
                detail: insertError.detail,
                hint: insertError.hint,
                where: insertError.where
            });
            
            await client.query('ROLLBACK');
            
            // Check if it's a unique constraint violation
            if (insertError.code === '23505') {
                return res.status(400).json({
                    success: false,
                    error: 'One or more items are already assigned to a store'
                });
            }
            
            return res.status(500).json({
                success: false,
                error: insertError.message || 'Failed to insert items into store'
            });
        }
        
        await client.query('COMMIT');
        console.log('Transaction committed successfully');
        
        res.json({
            success: true,
            message: force ? 'Items moved to new store successfully' : 'Items sent to store successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing outbound items:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            hint: error.hint,
            detail: error.detail
        });
        
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process outbound items'
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

// Get store items with locations
router.get('/:storeId/items-with-locations', async (req, res) => {
    const { storeId } = req.params;
    
    try {
        const query = `
            SELECT 
                r.*,
                s.received_at,
                s.store_id,
                st.name as store_name,
                COALESCE(l.location, 'unknown') as location
            FROM store_items s
            JOIN system_records r ON s.record_id = r.id
            JOIN stores st ON s.store_id = st.id
            LEFT JOIN item_locations l ON r.serialnumber = l.serialnumber
            WHERE s.store_id = $1
            ORDER BY s.received_at DESC
        `;
        
        const result = await pool.query(query, [storeId]);
        
        res.json({
            success: true,
            items: result.rows
        });
    } catch (error) {
        console.error('Error fetching store items with locations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch store items'
        });
    }
});

// Find which store an item is in
router.get('/find-item/:serialNumber', async (req, res) => {
    const { serialNumber } = req.params;
    
    try {
        const query = `
            SELECT s.* 
            FROM stores s
            JOIN store_items si ON s.id = si.store_id
            JOIN system_records r ON si.record_id = r.id
            WHERE r.serialnumber = $1
            LIMIT 1
        `;
        
        const result = await pool.query(query, [serialNumber]);
        
        if (result.rows.length === 0) {
            return res.json({
                success: false,
                error: 'Item not found in any store'
            });
        }
        
        res.json({
            success: true,
            store: result.rows[0]
        });
    } catch (error) {
        console.error('Error finding item store:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to find item store'
        });
    }
});

module.exports = router; 