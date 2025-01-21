const express = require('express');
const router = express.Router();
const pool = require('../db');
const { auth, checkRole } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');
const { ValidationError, AuthorizationError, NotFoundError } = require('../middleware/errorTypes');
const { QueryBuilder, queryTemplates, withTransaction } = require('../utils/queryBuilder');

// Get duplicate records (all authenticated users)
router.get('/duplicates', auth, catchAsync(async (req, res) => {
    const result = await pool.query(queryTemplates.duplicates);
    res.json({
        success: true,
        duplicates: result.rows
    });
}));

// Clean up duplicate records (admin only)
router.post('/cleanup-duplicates', auth, checkRole(['admin']), catchAsync(async (req, res) => {
    const client = await pool.connect();
    await withTransaction(client, async (client) => {
        const duplicates = await client.query(queryTemplates.duplicates + ' ORDER BY r.serialnumber, r.created_at DESC');
        
        let currentSerial = null;
        let isFirst = true;
        let deletedCount = 0;
        
        for (const record of duplicates.rows) {
            if (currentSerial !== record.serialnumber) {
                currentSerial = record.serialnumber;
                isFirst = true;
                continue;
            }
            
            if (!isFirst) {
                await client.query(`
                    UPDATE system_records 
                    SET is_current = false 
                    WHERE id = $1
                `, [record.id]);
                deletedCount++;
            }
            isFirst = false;
        }
        
        return res.json({
            success: true,
            message: `Successfully cleaned up duplicates. Removed ${deletedCount} older duplicate records.`
        });
    });
}));

// Search records
router.get('/search', auth, catchAsync(async (req, res) => {
    const { q } = req.query;
    if (!q) {
        throw new ValidationError('Search query is required');
    }

    // Format search terms for System SKU matching
    const searchTerms = q.toLowerCase().split(' ');
    const formattedSearch = searchTerms.join('_');
    const likeTerms = searchTerms.map((_, index) => `$${index + 2}`);

    const query = `
        SELECT *
        FROM system_records
        WHERE 
            is_current = true 
            AND (
                serialnumber ILIKE $1
                OR model ILIKE $1
                OR manufacturer ILIKE $1
                OR systemsku ILIKE $1
                OR computername ILIKE $1
                OR operatingsystem ILIKE $1
                OR cpu ILIKE $1
                OR CAST(id AS TEXT) ILIKE $1
                OR systemsku ILIKE '%' || $2 || '%'
                ${searchTerms.slice(1).map((_, idx) => 
                    `OR systemsku ILIKE '%' || ${likeTerms[idx + 1]} || '%'`
                ).join('\n')}
            )
        ORDER BY created_at DESC
        LIMIT 50
    `;

    const params = [`%${q}%`, ...searchTerms];
    const result = await pool.query(query, params);

    res.json({
        success: true,
        records: result.rows
    });
}));

// Get all records with store permission check
router.get('/', auth, checkRole(['user', 'admin'], true), catchAsync(async (req, res) => {
    const { page = 1, limit = 20, search = '', store_id } = req.query;
    const offset = (page - 1) * limit;
    const client = await pool.connect();

    try {
        // Get total count of records
        const countResult = await client.query('SELECT COUNT(*) FROM system_records WHERE is_current = true');
        const totalRecords = parseInt(countResult.rows[0].count);

        // Build the main query
        const query = `
            SELECT 
                r.*,
                TO_CHAR(r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD HH24:MI:SS') as formatted_date
            FROM system_records r
            WHERE r.is_current = true
            ${search ? `AND (
                r.serialnumber ILIKE $3 OR
                r.computername ILIKE $3 OR
                r.model ILIKE $3 OR
                r.systemsku ILIKE $3 OR
                r.manufacturer ILIKE $3
            )` : ''}
            ORDER BY r.created_at DESC, r.id DESC
            LIMIT $1 OFFSET $2
        `;

        const params = [limit, offset];
        if (search) {
            params.push(`%${search}%`);
        }

        const result = await client.query(query, params);

        res.json({
            success: true,
            records: result.rows.map(record => ({
                ...record,
                created_at: record.formatted_date
            })),
            total: totalRecords,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalRecords / limit)
        });
    } finally {
        client.release();
    }
}));

// Delete a record (admin only)
router.delete('/:id', auth, checkRole(['admin']), catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await pool.query(
        'UPDATE system_records SET is_current = false WHERE id = $1 RETURNING id',
        [id]
    );

    if (result.rows.length === 0) {
        throw new NotFoundError('Record not found');
    }

    res.json({
        success: true,
        message: 'Record deleted successfully'
    });
}));

// Create or update a record
router.post('/', catchAsync(async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const record = req.body;
        
        // Validate required fields
        const requiredFields = ['serialnumber', 'computername', 'manufacturer', 'model'];
        const missingFields = requiredFields.filter(field => !record[field]);
        if (missingFields.length > 0) {
            throw new ValidationError(`Missing required fields: ${missingFields.join(', ')}`);
        }
        
        // Check for existing record with same serial number
        const existingRecord = await client.query(
            'SELECT id FROM system_records WHERE serialnumber = $1',
            [record.serialnumber]
        );

        let result;
        if (existingRecord.rows.length > 0) {
            // Update existing record
            const recordId = existingRecord.rows[0].id;
            result = await client.query(`
                UPDATE system_records SET
                    computername = $1,
                    manufacturer = $2,
                    model = $3,
                    systemsku = $4,
                    operatingsystem = $5,
                    cpu = $6,
                    resolution = $7,
                    graphicscard = $8,
                    touchscreen = $9,
                    ram_gb = $10,
                    disks = $11,
                    design_capacity = $12,
                    full_charge_capacity = $13,
                    cycle_count = $14,
                    battery_health = $15,
                    created_at = NOW()
                WHERE id = $16
                RETURNING *
            `, [
                record.computername,
                record.manufacturer,
                record.model,
                record.systemsku,
                record.operatingsystem,
                record.cpu,
                record.resolution,
                record.graphicscard,
                record.touchscreen,
                record.ram_gb,
                record.disks,
                record.design_capacity,
                record.full_charge_capacity,
                record.cycle_count,
                record.battery_health,
                recordId
            ]);
        } else {
            // Insert new record
            result = await client.query(`
                INSERT INTO system_records (
                    serialnumber,
                    computername,
                    manufacturer,
                    model,
                    systemsku,
                    operatingsystem,
                    cpu,
                    resolution,
                    graphicscard,
                    touchscreen,
                    ram_gb,
                    disks,
                    design_capacity,
                    full_charge_capacity,
                    cycle_count,
                    battery_health
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING *
            `, [
                record.serialnumber,
                record.computername,
                record.manufacturer,
                record.model,
                record.systemsku,
                record.operatingsystem,
                record.cpu,
                record.resolution,
                record.graphicscard,
                record.touchscreen,
                record.ram_gb,
                record.disks,
                record.design_capacity,
                record.full_charge_capacity,
                record.cycle_count,
                record.battery_health
            ]);
        }

        await client.query('COMMIT');
        
        res.json({
            success: true,
            record: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}));

// Add item to outbound
router.post('/outbound/:id', catchAsync(async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        // Check if item already exists in outbound
        const existingItem = await client.query(
            'SELECT id, serialnumber FROM outbound_items oi JOIN system_records sr ON oi.record_id = sr.id WHERE record_id = $1 AND status = $2',
            [id, 'pending']
        );
        
        if (existingItem.rows.length > 0) {
            throw new ValidationError(`Serial Number ${existingItem.rows[0].serialnumber} is already in outbound list`);
        }
        
        // Add to outbound
        const result = await client.query(
            'INSERT INTO outbound_items (record_id, status) VALUES ($1, $2) RETURNING *',
            [id, 'pending']
        );
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            item: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}));

// Check item location
router.get('/check-location/:serialNumber', catchAsync(async (req, res) => {
    const { serialNumber } = req.params;
    const client = await pool.connect();
    
    try {
        // Check if item is in any store
        const storeQuery = `
            SELECT s.name as store_name
            FROM system_records r
            JOIN store_items si ON r.id = si.record_id
            JOIN stores s ON si.store_id = s.id
            WHERE r.serialnumber = $1
        `;
        
        const storeResult = await client.query(storeQuery, [serialNumber]);
        
        if (storeResult.rows.length > 0) {
            return res.json({
                success: true,
                location: 'store',
                storeName: storeResult.rows[0].store_name
            });
        }
        
        // Check if item is in inventory
        const inventoryQuery = `
            SELECT id
            FROM system_records
            WHERE serialnumber = $1
            AND is_current = true
        `;
        
        const inventoryResult = await client.query(inventoryQuery, [serialNumber]);
        
        if (inventoryResult.rows.length > 0) {
            return res.json({
                success: true,
                location: 'inventory'
            });
        }
        
        // Item not found
        res.json({
            success: true,
            location: 'none'
        });
    } finally {
        client.release();
    }
}));

// Get records with locations
router.get('/with-locations', catchAsync(async (req, res) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT 
                r.*,
                CASE
                    WHEN si.store_id IS NOT NULL THEN 'store'
                    ELSE 'inventory'
                END as location,
                s.name as store_name
            FROM system_records r
            LEFT JOIN store_items si ON r.id = si.record_id
            LEFT JOIN stores s ON si.store_id = s.id
            WHERE r.is_current = true
            ORDER BY r.created_at DESC
        `;
        
        const result = await client.query(query);
        
        res.json({
            success: true,
            records: result.rows
        });
    } finally {
        client.release();
    }
}));

module.exports = router; 