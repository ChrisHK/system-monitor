const express = require('express');
const router = express.Router();
const pool = require('../db');
const { auth } = require('../middleware/auth');
const { checkMainPermission } = require('../middleware/checkPermission');
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
router.post('/cleanup-duplicates', auth, checkMainPermission('inventory'), catchAsync(async (req, res) => {
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
    const { q, field } = req.query;
    if (!q) {
        throw new ValidationError('Search query is required');
    }

    console.log('Search request:', {
        query: q,
        field,
        timestamp: new Date().toISOString()
    });

    // 檢查所有相關記錄
    const allRecords = await pool.query(
        'SELECT * FROM system_records WHERE serialnumber = $1',
        [q]
    );

    console.log('All matching records:', {
        count: allRecords.rows.length,
        records: allRecords.rows,
        timestamp: new Date().toISOString()
    });

    // 首先直接查詢完全匹配
    const exactMatch = await pool.query(
        'SELECT * FROM system_records WHERE serialnumber = $1 AND is_current = true',
        [q]
    );

    console.log('Exact match results:', {
        count: exactMatch.rows.length,
        records: exactMatch.rows,
        timestamp: new Date().toISOString()
    });

    if (exactMatch.rows.length > 0) {
        return res.json({
            success: true,
            records: exactMatch.rows
        });
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
    console.log('Executing search query:', {
        query,
        params,
        timestamp: new Date().toISOString()
    });

    const result = await pool.query(query, params);

    console.log('Search results:', {
        count: result.rows.length,
        firstRecord: result.rows[0],
        lastRecord: result.rows[result.rows.length - 1],
        timestamp: new Date().toISOString()
    });

    res.json({
        success: true,
        records: result.rows
    });
}));

// 檢查權限中間件
const checkInventoryPermission = (req, res, next) => {
    console.log('Checking inventory permission:', {
        user: {
            id: req.user?.id,
            group_name: req.user?.group_name,
            main_permissions: req.user?.main_permissions
        }
    });

    // 檢查用戶是否是管理員
    if (req.user.group_name === 'admin') {
        console.log('User is admin, granting access');
        // 确保 admin 用户有所有权限
        req.user.main_permissions = {
            ...req.user.main_permissions,
            inventory: true,
            inventory_ram: true,
            outbound: true,
            inbound: true
        };
        return next();
    }

    // 檢查用戶是否有 inventory 權限
    if (req.user.main_permissions?.inventory === true) {
        console.log('User has inventory permission, granting access');
        return next();
    }

    console.log('Access denied: No inventory permission');
    return res.status(403).json({
        success: false,
        error: 'No permission to access inventory'
    });
};

// Get all records with inventory permission check
router.get('/', auth, checkInventoryPermission, catchAsync(async (req, res) => {
    const { page = 1, limit = 20, search = '', store_id } = req.query;
    const offset = (page - 1) * limit;
    const client = await pool.connect();

    try {
        console.log('Fetching records with params:', {
            page,
            limit,
            offset,
            search,
            store_id
        });

        // First check if the table exists
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'system_records'
            );
        `);
        
        console.log('Table check result:', tableCheck.rows[0]);

        if (!tableCheck.rows[0].exists) {
            throw new Error('system_records table does not exist');
        }

        // Get total count of records
        const countResult = await client.query(`
            SELECT COUNT(*) 
            FROM system_records 
            WHERE is_current = true
        `);
        const totalRecords = parseInt(countResult.rows[0].count);

        console.log('Count query result:', {
            totalRecords,
            query: countResult.command
        });

        // Build the main query
        const query = `
            SELECT 
                r.*,
                TO_CHAR(r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York', 'YYYY-MM-DD HH24:MI:SS') as formatted_date
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

        console.log('Executing query:', {
            query,
            params
        });

        const result = await client.query(query, params);

        console.log('Records query result:', {
            totalRecords,
            returnedRecords: result.rows.length,
            page,
            limit,
            firstRecord: result.rows[0],
            lastRecord: result.rows[result.rows.length - 1]
        });

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
    } catch (error) {
        console.error('Error fetching records:', error);
        throw error;
    } finally {
        client.release();
    }
}));

// Delete a record (admin only)
router.delete('/:id', auth, checkMainPermission('inventory'), catchAsync(async (req, res) => {
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

// Debug route - get all records for a serial number
router.get('/debug/:serialnumber', auth, catchAsync(async (req, res) => {
    const { serialnumber } = req.params;
    
    console.log('Debug query for serial number:', {
        serialnumber,
        timestamp: new Date().toISOString()
    });

    const result = await pool.query(
        'SELECT * FROM system_records WHERE serialnumber = $1 ORDER BY created_at DESC',
        [serialnumber]
    );

    console.log('Debug query results:', {
        count: result.rows.length,
        records: result.rows,
        timestamp: new Date().toISOString()
    });

    res.json({
        success: true,
        records: result.rows
    });
}));

module.exports = router; 