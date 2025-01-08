const express = require('express');
const router = express.Router();
const pool = require('../db');

// Get duplicate records
router.get('/duplicates', async (req, res) => {
    try {
        const query = `
            SELECT serialnumber
            FROM system_records
            WHERE serialnumber IS NOT NULL
            AND is_current = true
            GROUP BY serialnumber
            HAVING COUNT(*) > 1
        `;
        
        const result = await pool.query(query);
        
        res.json({
            success: true,
            duplicates: result.rows
        });
    } catch (error) {
        console.error('Error fetching duplicates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch duplicates'
        });
    }
});

// Search records by field and term
router.get('/search', async (req, res) => {
    const { field, term } = req.query;
    
    try {
        // Validate required parameters
        if (!field || !term) {
            return res.status(400).json({
                success: false,
                error: 'Field and search term are required'
            });
        }

        // Build the query with ILIKE for case-insensitive search
        const query = `
            SELECT * FROM system_records 
            WHERE ${field} ILIKE $1 
            AND is_current = true
            ORDER BY created_at DESC
            LIMIT 1
        `;
        
        const result = await pool.query(query, [`%${term}%`]);
        
        res.json({
            success: true,
            records: result.rows
        });
    } catch (error) {
        console.error('Error searching records:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search records'
        });
    }
});

// Get all records
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT * FROM system_records 
            WHERE is_current = true 
            ORDER BY created_at DESC
        `);
        
        res.json({
            success: true,
            records: result.rows
        });
    } catch (error) {
        console.error('Error fetching records:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch records'
        });
    }
});

// Delete a record
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        // First check if record exists and is a duplicate
        const checkQuery = `
            SELECT r.id, r.serialnumber
            FROM system_records r
            WHERE r.id = $1
            AND r.is_current = true
            AND EXISTS (
                SELECT 1 
                FROM system_records r2 
                WHERE r2.serialnumber = r.serialnumber 
                AND r2.id != r.id 
                AND r2.is_current = true
            )
        `;
        
        const checkResult = await pool.query(checkQuery, [id]);
        
        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Record not found or not a duplicate'
            });
        }

        // Delete the record (soft delete by setting is_current to false)
        const deleteQuery = `
            UPDATE system_records 
            SET is_current = false 
            WHERE id = $1 
            RETURNING id, serialnumber
        `;
        
        const result = await pool.query(deleteQuery, [id]);
        
        res.json({
            success: true,
            message: `Record ${result.rows[0].serialnumber} deleted successfully`
        });
    } catch (error) {
        console.error('Error deleting record:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete record'
        });
    }
});

module.exports = router; 