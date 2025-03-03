const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { checkMainPermission } = require('../middleware/checkPermission');
const pool = require('../db');

// Get inventory items with pagination
router.get('/', auth, checkMainPermission('inventory'), async (req, res) => {
    const { page = 1, limit = 50, searchText } = req.query;
    const offset = (page - 1) * limit;

    try {
        // 基礎查詢
        let baseQuery = `
            FROM system_records r
            LEFT JOIN item_locations l ON r.serialnumber = l.serialnumber
            WHERE (l.location = 'inventory' OR l.location IS NULL)
        `;

        const params = [];
        
        // 添加搜索條件
        if (searchText) {
            params.push(`%${searchText}%`);
            baseQuery += ` AND (
                r.serialnumber ILIKE $${params.length} OR 
                r.computername ILIKE $${params.length} OR 
                r.model ILIKE $${params.length}
            )`;
        }

        // 獲取總數的查詢
        const countQuery = `
            SELECT COUNT(*) 
            ${baseQuery}
        `;

        // 獲取數據的查詢
        const dataQuery = `
            SELECT 
                r.*,
                COALESCE(l.location, 'inventory') as location,
                l.store_id,
                l.store_name,
                l.updated_at as location_updated
            ${baseQuery}
            ORDER BY r.created_at DESC
            LIMIT $${params.length + 1} 
            OFFSET $${params.length + 2}
        `;

        // 執行總數查詢
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);

        // 添加分頁參數
        params.push(limit, offset);

        // 執行數據查詢
        const result = await pool.query(dataQuery, params);

        console.log('Inventory query results:', {
            total,
            page,
            limit,
            offset,
            resultCount: result.rows.length,
            params
        });

        res.json({
            success: true,
            items: result.rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching inventory items:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch inventory items',
            details: error.message
        });
    }
});

// Get RAM inventory
router.get('/ram', auth, checkMainPermission('inventory_ram'), async (req, res) => {
    try {
        const query = `
            SELECT 
                r.*,
                COALESCE(l.location, 'inventory') as location,
                l.store_id,
                l.store_name,
                l.updated_at as location_updated
            FROM system_records r
            LEFT JOIN item_locations l ON r.serialnumber = l.serialnumber
            WHERE (l.location = 'inventory' OR l.location IS NULL)
            AND r.ram_gb IS NOT NULL
            ORDER BY r.ram_gb DESC
        `;

        const result = await pool.query(query);

        res.json({
            success: true,
            items: result.rows
        });
    } catch (error) {
        console.error('Error fetching RAM inventory:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch RAM inventory'
        });
    }
});

router.get('/records', auth, async (req, res) => {
    const { page = 1, pageSize = 50 } = req.query;
    const offset = (page - 1) * pageSize;

    try {
        // 獲取分頁數據
        const result = await pool.query(`
            SELECT * FROM system_records
            WHERE is_current = true
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
        `, [pageSize, offset]);

        res.json({
            success: true,
            records: result.rows,
            total: result.rows.length,
            page: parseInt(page),
            pageSize: parseInt(pageSize)
        });
    } catch (error) {
        console.error('Error fetching records:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch records'
        });
    }
});

module.exports = router; 