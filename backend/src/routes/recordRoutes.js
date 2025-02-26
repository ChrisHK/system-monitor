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
    
    try {
        await client.query('BEGIN');

        // 1. 獲取當前記錄數量
        const countBefore = await client.query('SELECT COUNT(*) FROM system_records WHERE is_current = true');
        
        // 2. 找出每個序列號最新的記錄並直接更新
        const updateResult = await client.query(`
            WITH latest_records AS (
                SELECT id, serialnumber,
                    ROW_NUMBER() OVER (PARTITION BY serialnumber ORDER BY created_at DESC) as rn
                FROM system_records
                WHERE is_current = true
            )
            UPDATE system_records
            SET is_current = false
            WHERE id NOT IN (
                SELECT id 
                FROM latest_records 
                WHERE rn = 1
            )
            AND is_current = true
            RETURNING id
        `);

        // 3. 獲取更新後的記錄數量
        const countAfter = await client.query('SELECT COUNT(*) FROM system_records WHERE is_current = true');

        await client.query('COMMIT');

        // 4. 返回清理結果
        res.json({
            success: true,
            message: 'Duplicate records cleaned up successfully',
            details: {
                totalBefore: parseInt(countBefore.rows[0].count),
                totalAfter: parseInt(countAfter.rows[0].count),
                archivedCount: updateResult.rowCount,
                timestamp: await client.query('SELECT NOW()::timestamp').then(result => result.rows[0].now)
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error cleaning up duplicates:', {
            error: error.message,
            stack: error.stack,
            timestamp: await client.query('SELECT NOW()::timestamp').then(result => result.rows[0].now)
        });
        
        res.status(500).json({
            success: false,
            error: 'Failed to clean up duplicate records',
            detail: error.message
        });
    } finally {
        client.release();
    }
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
        timestamp: await pool.query('SELECT NOW()::timestamp').then(result => result.rows[0].now)
    });

    // 檢查所有相關記錄
    const allRecords = await pool.query(`
        SELECT 
            r.*,
            r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York' as created_at_est,
            TO_CHAR(r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York', 'YYYY-MM-DD HH24:MI:SS') as formatted_date
        FROM system_records r
        WHERE r.serialnumber = $1 
        AND r.is_current = true
        ORDER BY r.created_at DESC
    `, [q]);

    console.log('All matching records:', {
        count: allRecords.rows.length,
        records: allRecords.rows.map(record => ({
            ...record,
            created_at: record.formatted_date,
            created_at_est: record.created_at_est
        })),
        timestamp: await pool.query('SELECT NOW()::timestamp').then(result => result.rows[0].now)
    });

    // 首先直接查詢完全匹配
    const exactMatch = await pool.query(`
        SELECT 
            r.*,
            r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York' as created_at_est,
            TO_CHAR(r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York', 'YYYY-MM-DD HH24:MI:SS') as formatted_date
        FROM system_records r
        WHERE r.serialnumber = $1 
        AND r.is_current = true
    `, [q]);

    console.log('Exact match results:', {
        count: exactMatch.rows.length,
        records: exactMatch.rows,
        timestamp: await pool.query('SELECT NOW()::timestamp').then(result => result.rows[0].now)
    });

    if (exactMatch.rows.length > 0) {
        return res.json({
            success: true,
            records: exactMatch.rows.map(record => ({
                ...record,
                created_at: record.formatted_date,
                created_at_est: record.created_at_est
            }))
        });
    }

    // Format search terms for System SKU matching
    const searchTerms = q.toLowerCase().split(' ');
    const formattedSearch = searchTerms.join('_');
    const likeTerms = searchTerms.map((_, index) => `$${index + 2}`);

    const query = `
        SELECT 
            r.*,
            r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York' as created_at_est,
            TO_CHAR(r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York', 'YYYY-MM-DD HH24:MI:SS') as formatted_date
        FROM system_records r
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
        ORDER BY r.created_at DESC
        LIMIT 50
    `;

    const params = [`%${q}%`, ...searchTerms];
    console.log('Executing search query:', {
        query,
        params,
        timestamp: await pool.query('SELECT NOW()::timestamp').then(result => result.rows[0].now)
    });

    const result = await pool.query(query, params);

    console.log('Search results:', {
        count: result.rows.length,
        firstRecord: result.rows[0],
        lastRecord: result.rows[result.rows.length - 1],
        timestamp: await pool.query('SELECT NOW()::timestamp').then(result => result.rows[0].now)
    });

    res.json({
        success: true,
        records: result.rows.map(record => ({
            ...record,
            created_at: record.formatted_date,
            created_at_est: record.created_at_est
        }))
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
        console.log('Starting records fetch with params:', {
            page,
            limit,
            search,
            store_id,
            timestamp: await client.query('SELECT NOW()::timestamp').then(result => result.rows[0].now)
        });

        // 1. 獲取所有記錄的總數（包括歷史記錄）
        const totalAllQuery = 'SELECT COUNT(*) FROM system_records';
        const totalAllResult = await client.query(totalAllQuery);
        const totalAll = parseInt(totalAllResult.rows[0].count);

        // 2. 獲取當前有效記錄的總數
        const currentRecordsQuery = 'SELECT COUNT(*) FROM system_records WHERE is_current = true';
        const currentRecordsResult = await client.query(currentRecordsQuery);
        const currentRecords = parseInt(currentRecordsResult.rows[0].count);

        // 3. 獲取唯一序列號的數量
        const uniqueSerialsQuery = `
            SELECT COUNT(DISTINCT serialnumber) 
            FROM system_records 
            WHERE is_current = true
        `;
        const uniqueSerialsResult = await client.query(uniqueSerialsQuery);
        const uniqueSerials = parseInt(uniqueSerialsResult.rows[0].count);

        // 4. 記錄計數結果
        console.log('Count queries results:', {
            totalAll,
            currentRecords,
            uniqueSerials,
            timestamp: await client.query('SELECT NOW()::timestamp').then(result => result.rows[0].now)
        });

        // 5. 構建主查詢
        let query = `
            SELECT 
                r.*,
                TO_CHAR(r.created_at, 'YYYY-MM-DD HH24:MI:SS') as formatted_date
            FROM system_records r
            WHERE r.is_current = true
        `;

        const params = [];
        
        if (search) {
            params.push(`%${search}%`);
            query += `
                AND (
                    r.serialnumber ILIKE $${params.length} OR
                    r.computername ILIKE $${params.length} OR
                    r.model ILIKE $${params.length} OR
                    r.systemsku ILIKE $${params.length} OR
                    r.manufacturer ILIKE $${params.length}
                )
            `;
        }

        // 添加分頁
        query += ` ORDER BY r.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        // 6. 執行主查詢
        console.log('Executing main query:', {
            query,
            params,
            timestamp: await client.query('SELECT NOW()::timestamp').then(result => result.rows[0].now)
        });

        const result = await client.query(query, params);

        // 7. 記錄查詢結果
        console.log('Main query results:', {
            rowCount: result.rowCount,
            firstRecord: result.rows[0],
            lastRecord: result.rows[result.rows.length - 1],
            timestamp: await client.query('SELECT NOW()::timestamp').then(result => result.rows[0].now)
        });

        // 8. 返回結果
        res.json({
            success: true,
            records: result.rows,
            total: currentRecords,
            totalAll: totalAll,
            uniqueSerials: uniqueSerials,
            currentPage: parseInt(page),
            totalPages: Math.ceil(currentRecords / limit)
        });

    } catch (error) {
        console.error('Error in records fetch:', {
            error: error.message,
            stack: error.stack,
            timestamp: await client.query('SELECT NOW()::timestamp').then(result => result.rows[0].now)
        });
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
        timestamp: await pool.query('SELECT NOW()::timestamp').then(result => result.rows[0].now)
    });

    const result = await pool.query(`
        SELECT 
            r.*,
            r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York' as created_at_est,
            TO_CHAR(r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York', 'YYYY-MM-DD HH24:MI:SS') as formatted_date
        FROM system_records r
        WHERE r.serialnumber = $1 
        AND r.is_current = true
        ORDER BY r.created_at DESC
    `, [serialnumber]);

    console.log('Debug query results:', {
        count: result.rows.length,
        records: result.rows,
        timestamp: await pool.query('SELECT NOW()::timestamp').then(result => result.rows[0].now)
    });

    res.json({
        success: true,
        records: result.rows.map(record => ({
            ...record,
            created_at: record.formatted_date,
            created_at_est: record.created_at_est
        }))
    });
}));

// 清理重複記錄
router.post('/cleanup-duplicates', auth, checkInventoryPermission, async (req, res) => {
    const client = await pool.connect();
    let transactionActive = false;

    try {
        await client.query('BEGIN');
        transactionActive = true;

        // 1. 獲取當前記錄數量
        const countBefore = await client.query('SELECT COUNT(*) FROM system_records');

        // 2. 找出要保留的記錄（每個序列號最新的一條）
        const keepRecords = await client.query(`
            SELECT id, serialnumber, created_at
            FROM system_records sr1
            WHERE created_at = (
                SELECT MAX(created_at)
                FROM system_records sr2
                WHERE sr2.serialnumber = sr1.serialnumber
            )
        `);

        if (keepRecords.rows.length === 0) {
            throw new Error('No records found to process');
        }

        // 3. 將其他記錄移動到歸檔表
        const archiveResult = await client.query(`
            WITH archived_records AS (
                INSERT INTO system_records_archive (
                    original_id,
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
                    battery_health,
                    created_at,
                    is_current,
                    archived_at
                )
                SELECT 
                    id,
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
                    battery_health,
                    created_at,
                    is_current,
                    NOW()
                FROM system_records
                WHERE id NOT IN ($1)
                RETURNING id
            )
            SELECT COUNT(*) as count FROM archived_records
        `, [keepRecords.rows.map(r => r.id)]);

        // 4. 更新原始記錄的狀態
        await client.query(`
            UPDATE system_records
            SET is_current = CASE 
                WHEN id = ANY($1) THEN true
                ELSE false
            END
        `, [keepRecords.rows.map(r => r.id)]);

        // 5. 獲取更新後的記錄數量
        const countAfter = await client.query(`
            SELECT COUNT(*) FROM system_records WHERE is_current = true
        `);

        await client.query('COMMIT');
        transactionActive = false;

        res.json({
            success: true,
            message: 'Records archived successfully',
            details: {
                totalBefore: parseInt(countBefore.rows[0].count),
                totalAfter: parseInt(countAfter.rows[0].count),
                archivedCount: parseInt(archiveResult.rows[0].count),
                timestamp: await client.query('SELECT NOW()::timestamp').then(result => result.rows[0].now)
            }
        });

    } catch (error) {
        if (transactionActive) {
            await client.query('ROLLBACK');
        }
        console.error('Error archiving records:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to archive records',
            details: error.message
        });
    } finally {
        client.release();
    }
});

module.exports = router; 