const express = require('express');
const router = express.Router();
const { auth, adminOnly } = require('../middleware/auth');
const pool = require('../db');
const { logger } = require('../utils/logger');
const { validateRmaStatus } = require('../utils/validation');
const ExcelJS = require('exceljs');

// Get all inventory RMA items with pagination
router.get('/', auth, async (req, res) => {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const client = await pool.connect();
    try {
        // Get total count
        const countResult = await client.query(
            'SELECT COUNT(*) FROM store_rma WHERE location_type = $1',
            ['inventory']
        );
        const total = parseInt(countResult.rows[0].count);

        logger.info('Count query result:', {
            total,
            query: 'SELECT COUNT(*) FROM store_rma WHERE location_type = inventory'
        });

        // Debug: Check all RMA items status
        const statusQuery = await client.query(`
            SELECT location_type, inventory_status, COUNT(*) 
            FROM store_rma 
            GROUP BY location_type, inventory_status
        `);
        logger.info('RMA Status Distribution:', statusQuery.rows);

        // Get paginated items with correct joins
        const query = `
            SELECT 
                rma.id as rma_id,
                rma.store_id,
                rma.record_id,
                rma.reason,
                rma.notes,
                rma.rma_date,
                rma.store_status,
                rma.inventory_status,
                rma.location_type,
                rma.received_at,
                rma.processed_at,
                rma.completed_at,
                rma.failed_at,
                rma.failed_reason,
                s.name as store_name,
                r.serialnumber,
                r.model,
                r.systemsku,
                r.computername,
                r.ram_gb,
                r.operatingsystem,
                r.cpu,
                r.disks
            FROM store_rma rma
            LEFT JOIN stores s ON rma.store_id = s.id
            LEFT JOIN system_records r ON rma.record_id = r.id
            WHERE rma.location_type = $1
            ORDER BY rma.rma_date DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await client.query(query, ['inventory', limit, offset]);

        logger.info('Inventory RMA query details:', {
            parameters: ['inventory', limit, offset],
            rowCount: result.rowCount,
            rows: result.rows
        });

        const response = {
            success: true,
            rma_items: result.rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        };

        logger.info('Response data:', response);

        res.json(response);
    } catch (error) {
        logger.error('Error fetching inventory RMA items:', {
            error: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            position: error.position,
            query: error.query
        });
        
        let errorMessage = 'Failed to fetch RMA items';
        if (error.code === '42P01') {
            errorMessage = 'Table does not exist';
        } else if (error.code === '42703') {
            errorMessage = 'Column does not exist';
        } else if (error.code === '28P01') {
            errorMessage = 'Database connection failed';
        }
        
        res.status(500).json({ 
            success: false,
            error: errorMessage,
            details: error.message
        });
    } finally {
        client.release();
    }
});

// Process an RMA item
router.put('/:rmaId/process', auth, async (req, res) => {
    const { rmaId } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Check current status
        const statusResult = await client.query(
            'SELECT inventory_status FROM store_rma WHERE id = $1',
            [rmaId]
        );

        if (!statusResult.rows.length) {
            throw new Error('RMA item not found');
        }

        const currentStatus = statusResult.rows[0].inventory_status;
        if (currentStatus !== 'receive') {
            throw new Error('Invalid status transition');
        }

        // Update status
        await client.query(`
            UPDATE store_rma 
            SET inventory_status = 'process', processed_at = NOW() 
            WHERE id = $1
        `, [rmaId]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error processing RMA:', error);
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Complete an RMA item
router.put('/:rmaId/complete', auth, async (req, res) => {
    const { rmaId } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Check current status
        const statusResult = await client.query(
            'SELECT inventory_status FROM store_rma WHERE id = $1',
            [rmaId]
        );

        if (!statusResult.rows.length) {
            throw new Error('RMA item not found');
        }

        const currentStatus = statusResult.rows[0].inventory_status;
        if (currentStatus !== 'process') {
            throw new Error('Invalid status transition');
        }

        // Update status
        await client.query(`
            UPDATE store_rma 
            SET inventory_status = 'complete', completed_at = NOW() 
            WHERE id = $1
        `, [rmaId]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error completing RMA:', error);
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Fail an RMA item
router.put('/:rmaId/fail', auth, async (req, res) => {
    const { rmaId } = req.params;
    const { reason } = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Check current status
        const statusResult = await client.query(
            'SELECT inventory_status FROM store_rma WHERE id = $1',
            [rmaId]
        );

        if (!statusResult.rows.length) {
            throw new Error('RMA item not found');
        }

        const currentStatus = statusResult.rows[0].inventory_status;
        if (!['receive', 'process'].includes(currentStatus)) {
            throw new Error('Invalid status transition');
        }

        if (!reason) {
            throw new Error('Reason is required for failing an RMA');
        }

        // Update status
        await client.query(`
            UPDATE store_rma 
            SET inventory_status = 'failed', 
                failed_at = NOW(),
                failed_reason = $2
            WHERE id = $1
        `, [rmaId, reason]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error failing RMA:', error);
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Delete an RMA item (admin only)
router.delete('/:rmaId', auth, async (req, res) => {
    // Check if user is admin
    if (req.user.group_name !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            error: 'Only admin users can delete RMA items' 
        });
    }

    const { rmaId } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Delete RMA item
        const result = await client.query(
            'DELETE FROM store_rma WHERE id = $1 RETURNING *',
            [rmaId]
        );

        if (!result.rows.length) {
            throw new Error('RMA item not found');
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error deleting RMA:', error);
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
});

// Get RMA statistics
router.get('/stats', auth, async (req, res) => {
    const client = await pool.connect();

    try {
        // Get status counts
        const statusResult = await client.query(`
            SELECT 
                inventory_status,
                COUNT(*) as count
            FROM store_rma
            WHERE location_type = 'inventory'
            GROUP BY inventory_status
        `);

        // Get average processing times
        const timesResult = await client.query(`
            SELECT 
                AVG(EXTRACT(EPOCH FROM (processed_at - rma_date))) as avg_receive_time,
                AVG(EXTRACT(EPOCH FROM (completed_at - processed_at))) as avg_process_time
            FROM store_rma
            WHERE location_type = 'inventory'
            AND completed_at IS NOT NULL
        `);

        const statusCounts = statusResult.rows.reduce((acc, row) => {
            acc[row.inventory_status] = parseInt(row.count);
            return acc;
        }, {});

        const processingTimes = timesResult.rows[0];

        res.json({
            statusCounts,
            processingTimes: {
                avgReceiveTime: processingTimes.avg_receive_time ? Math.round(processingTimes.avg_receive_time) : 0,
                avgProcessTime: processingTimes.avg_process_time ? Math.round(processingTimes.avg_process_time) : 0
            }
        });
    } catch (error) {
        logger.error('Error fetching RMA statistics:', error);
        res.status(500).json({ error: 'Failed to fetch RMA statistics' });
    } finally {
        client.release();
    }
});

// Export RMA data to Excel
router.get('/export', auth, async (req, res) => {
    const { searchText, status } = req.query;
    const client = await pool.connect();

    try {
        let query = `
            SELECT 
                sr.*,
                s.name as store_name,
                si.model,
                si.system_sku,
                si.serialnumber
            FROM store_rma sr
            LEFT JOIN stores s ON sr.store_id = s.id
            LEFT JOIN store_items si ON sr.record_id = si.id
            WHERE sr.location_type = 'inventory'
        `;

        const params = [];
        if (searchText) {
            params.push(`%${searchText}%`);
            query += ` AND (si.serialnumber ILIKE $${params.length} OR sr.notes ILIKE $${params.length} OR sr.reason ILIKE $${params.length})`;
        }

        if (status && status !== 'all') {
            params.push(status);
            query += ` AND sr.inventory_status = $${params.length}`;
        }

        query += ' ORDER BY sr.rma_date DESC';

        const result = await client.query(query, params);

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('RMA Items');

        // Add headers
        worksheet.columns = [
            { header: 'Serial Number', key: 'serialnumber' },
            { header: 'Store', key: 'store_name' },
            { header: 'Model', key: 'model' },
            { header: 'System SKU', key: 'system_sku' },
            { header: 'Status', key: 'inventory_status' },
            { header: 'RMA Date', key: 'rma_date' },
            { header: 'Processed Date', key: 'processed_at' },
            { header: 'Completed Date', key: 'completed_at' },
            { header: 'Failed Date', key: 'failed_at' },
            { header: 'Reason', key: 'reason' },
            { header: 'Notes', key: 'notes' }
        ];

        // Add rows
        worksheet.addRows(result.rows);

        // Format dates
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                ['rma_date', 'processed_at', 'completed_at', 'failed_at'].forEach(dateField => {
                    if (row.getCell(dateField).value) {
                        row.getCell(dateField).value = new Date(row.getCell(dateField).value).toLocaleString();
                    }
                });
            }
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=rma_items.xlsx');

        // Send workbook
        await workbook.xlsx.write(res);
    } catch (error) {
        logger.error('Error exporting RMA data:', error);
        res.status(500).json({ error: 'Failed to export RMA data' });
    } finally {
        client.release();
    }
});

// Update RMA fields
router.put('/:rmaId', auth, async (req, res) => {
    const { rmaId } = req.params;
    const updates = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Validate the RMA exists and is in process status
        const checkResult = await client.query(
            'SELECT inventory_status FROM store_rma WHERE id = $1',
            [rmaId]
        );

        if (checkResult.rows.length === 0) {
            throw new Error('RMA item not found');
        }

        if (checkResult.rows[0].inventory_status !== 'process') {
            throw new Error('Can only update RMA items in process status');
        }

        // Update the fields
        const updateQuery = `
            UPDATE store_rma 
            SET ${Object.keys(updates).map((key, i) => `${key} = $${i + 2}`).join(', ')},
                last_updated = NOW()
            WHERE id = $1
            RETURNING *
        `;

        const values = [rmaId, ...Object.values(updates)];
        const result = await client.query(updateQuery, values);

        await client.query('COMMIT');
        
        res.json({
            success: true,
            rma: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error updating RMA:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
});

module.exports = router; 