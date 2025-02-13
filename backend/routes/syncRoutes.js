const express = require('express');
const router = express.Router();
const { auth, checkGroup } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');
const db = require('../db');
const { createLogger } = require('../utils/logger');

const logger = createLogger('SyncRoutes');

// 獲取同步狀態
router.get('/status', auth, checkGroup(['admin']), catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query;
    
    const result = await db.query(`
        SELECT 
            s.table_name,
            s.total_records,
            s.success_count,
            s.failed_count,
            s.last_sync_at,
            c.is_enabled,
            c.sync_interval,
            c.batch_size,
            c.max_retries
        FROM sync_stats s
        LEFT JOIN sync_config c ON s.table_name = c.table_name
        WHERE s.sync_date BETWEEN $1 AND $2
    `, [startDate || new Date(), endDate || new Date()]);

    res.json({
        success: true,
        stats: result.rows
    });
}));

// 獲取同步配置
router.get('/config', auth, checkGroup(['admin']), catchAsync(async (req, res) => {
    const result = await db.query('SELECT * FROM sync_config ORDER BY table_name');
    
    res.json({
        success: true,
        config: result.rows
    });
}));

// 更新同步配置
router.put('/config/:table', auth, checkGroup(['admin']), catchAsync(async (req, res) => {
    const { table } = req.params;
    const { is_enabled, sync_interval, batch_size, max_retries } = req.body;

    const result = await db.query(`
        UPDATE sync_config
        SET 
            is_enabled = COALESCE($1, is_enabled),
            sync_interval = COALESCE($2, sync_interval),
            batch_size = COALESCE($3, batch_size),
            max_retries = COALESCE($4, max_retries),
            updated_at = CURRENT_TIMESTAMP
        WHERE table_name = $5
        RETURNING *
    `, [is_enabled, sync_interval, batch_size, max_retries, table]);

    if (result.rows.length === 0) {
        return res.status(404).json({
            success: false,
            error: 'Configuration not found'
        });
    }

    res.json({
        success: true,
        config: result.rows[0]
    });
}));

// 重試失敗的同步
router.post('/retry', auth, checkGroup(['admin']), catchAsync(async (req, res) => {
    const { table } = req.query;

    const query = table
        ? `UPDATE sync_log 
           SET sync_status = 'pending', 
               error_message = NULL,
               retry_count = 0
           WHERE sync_status = 'failed' 
           AND table_name = $1`
        : `UPDATE sync_log 
           SET sync_status = 'pending', 
               error_message = NULL,
               retry_count = 0
           WHERE sync_status = 'failed'`;

    const params = table ? [table] : [];
    await db.query(query, params);

    res.json({
        success: true,
        message: 'Failed syncs queued for retry'
    });
}));

// 獲取失敗的同步記錄
router.get('/failures', auth, checkGroup(['admin']), catchAsync(async (req, res) => {
    const { table, limit = 100, offset = 0 } = req.query;

    const query = `
        SELECT *
        FROM sync_log
        WHERE sync_status = 'failed'
        ${table ? 'AND table_name = $1' : ''}
        ORDER BY created_at DESC
        LIMIT $${table ? 2 : 1}
        OFFSET $${table ? 3 : 2}
    `;

    const params = table 
        ? [table, limit, offset]
        : [limit, offset];

    const result = await db.query(query, params);

    // 獲取總數
    const countQuery = `
        SELECT COUNT(*) as total
        FROM sync_log
        WHERE sync_status = 'failed'
        ${table ? 'AND table_name = $1' : ''}
    `;

    const countParams = table ? [table] : [];
    const countResult = await db.query(countQuery, countParams);

    res.json({
        success: true,
        failures: result.rows,
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
    });
}));

// 清理已完成的同步記錄
router.delete('/cleanup', auth, checkGroup(['admin']), catchAsync(async (req, res) => {
    const { days = 30 } = req.query;

    const result = await db.query(`
        DELETE FROM sync_log
        WHERE sync_status = 'completed'
        AND created_at < CURRENT_TIMESTAMP - INTERVAL '${days} days'
        RETURNING COUNT(*) as deleted_count
    `);

    res.json({
        success: true,
        message: `Cleaned up ${result.rows[0].deleted_count} completed sync records`
    });
}));

module.exports = router; 