const express = require('express');
const router = express.Router();
const pool = require('../db');

// Search records for outbound
router.get('/search', async (req, res) => {
    try {
        const { field, term } = req.query;
        console.log('Search params:', { field, term });

        if (!field || !term) {
            return res.status(400).json({
                success: false,
                error: 'Search field and term are required'
            });
        }

        // Use ILIKE for case-insensitive search with wildcards
        const searchQuery = `
            SELECT * FROM system_records 
            WHERE ${field} ILIKE $1 
            AND is_current = true
            ORDER BY created_at DESC
        `;
        const searchTerm = `%${term}%`;
        
        const result = await pool.query(searchQuery, [searchTerm]);
        
        res.json({
            success: true,
            records: result.rows,
            total: result.rows.length
        });
    } catch (err) {
        console.error('Error searching records:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to search records'
        });
    }
});

// Add item to outbound
router.post('/items', async (req, res) => {
    const client = await pool.connect();
    try {
        const { recordId } = req.body;
        console.log('Adding item to outbound:', { recordId });
        
        await client.query('BEGIN');

        // First, check if the record exists in system_records
        const recordCheck = await client.query(
            'SELECT * FROM system_records WHERE id = $1 AND is_current = true',
            [recordId]
        );
        console.log('Record check result:', { 
            found: recordCheck.rows.length > 0,
            recordId,
            rows: recordCheck.rows
        });

        if (recordCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Record not found'
            });
        }

        // Check if there's a pending outbound
        let outboundResult = await client.query(
            'SELECT id FROM outbound WHERE status = $1 ORDER BY created_at DESC LIMIT 1',
            ['pending']
        );

        let outboundId;
        if (outboundResult.rows.length === 0) {
            // Create new outbound if none exists
            const newOutbound = await client.query(
                'INSERT INTO outbound (status) VALUES ($1) RETURNING id',
                ['pending']
            );
            outboundId = newOutbound.rows[0].id;
            console.log('Created outbound record:', { outboundId });
        } else {
            outboundId = outboundResult.rows[0].id;
            console.log('Using existing outbound record:', { outboundId });
        }

        // Add item to outbound_items
        await client.query(
            `INSERT INTO outbound_items (outbound_id, record_id)
             VALUES ($1, $2)
             ON CONFLICT (outbound_id, record_id) DO NOTHING`,
            [outboundId, recordId]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Item added to outbound successfully',
            outboundId
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error adding item to outbound:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to add item to outbound'
        });
    } finally {
        client.release();
    }
});

// Get outbound items
router.get('/items', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT oi.*, sr.* 
             FROM outbound_items oi
             JOIN system_records sr ON oi.record_id = sr.id
             WHERE oi.outbound_id IN (
                 SELECT id FROM outbound WHERE status = 'pending'
             )
             ORDER BY oi.added_at DESC`,
            []
        );

        res.json({
            success: true,
            items: result.rows
        });
    } catch (err) {
        console.error('Error fetching outbound items:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch outbound items'
        });
    }
});

// Remove item from outbound
router.delete('/items/:recordId', async (req, res) => {
    const client = await pool.connect();
    try {
        const { recordId } = req.params;
        
        await client.query('BEGIN');

        // Delete the item from outbound_items
        await client.query(
            'DELETE FROM outbound_items WHERE record_id = $1',
            [recordId]
        );

        // Check if there are any items left in the current outbound
        const remainingItems = await client.query(
            `SELECT COUNT(*) FROM outbound_items oi
             JOIN outbound o ON oi.outbound_id = o.id
             WHERE o.status = 'pending'`
        );

        // If no items left, delete the outbound record
        if (parseInt(remainingItems.rows[0].count) === 0) {
            await client.query(
                "DELETE FROM outbound WHERE status = 'pending'"
            );
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Item removed from outbound successfully'
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error removing item from outbound:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to remove item from outbound'
        });
    } finally {
        client.release();
    }
});

// Confirm outbound
router.post('/:outboundId/confirm', async (req, res) => {
    const client = await pool.connect();
    try {
        const { outboundId } = req.params;
        const { notes } = req.body;

        await client.query('BEGIN');

        // Update outbound status
        await client.query(
            `UPDATE outbound 
             SET status = 'completed', 
                 completed_at = CURRENT_TIMESTAMP,
                 notes = $1
             WHERE id = $2`,
            [notes, outboundId]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Outbound confirmed successfully'
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error confirming outbound:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to confirm outbound'
        });
    } finally {
        client.release();
    }
});

module.exports = router; 