const express = require('express');
const router = express.Router();
const pool = require('../db');
const { auth } = require('../middleware/auth');
const { checksumValidator } = require('../middleware/validators');
const { processInventoryData, getLogs, getProcessingStatus, deleteLog, getSyncStatus } = require('../controllers/dataProcessController');

// 處理庫存數據 (需要 checksum 驗證)
router.post('/inventory', auth, checksumValidator, processInventoryData);

// 獲取處理日誌
router.get('/logs', auth, getLogs);

// 獲取處理狀態
router.get('/status/:batchId', auth, getProcessingStatus);

// 清理日誌
router.post('/logs/clean', auth, async (req, res) => {
    const client = await pool.connect();
    let currentTransaction = false;

    try {
        console.log('Starting logs cleanup process');

        // 1. 檢查表是否存在
        console.log('Checking if processing_logs table exists');
        const tableCheck = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'processing_logs'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.error('Processing logs table does not exist');
            throw new Error('Processing logs table does not exist');
        }
        console.log('Table exists, proceeding with cleanup');

        // 2. 開始事務
        await client.query('BEGIN');
        currentTransaction = true;
        console.log('Transaction started');

        // 3. 獲取當前記錄數量
        console.log('Getting current record count');
        const countBefore = await client.query('SELECT COUNT(*) FROM processing_logs');
        console.log('Current record count:', countBefore.rows[0].count);

        // 4. 刪除所有日誌記錄
        console.log('Deleting all logs');
        const deleteResult = await client.query('DELETE FROM processing_logs RETURNING id');
        console.log('Deleted records count:', deleteResult.rowCount);

        // 5. 提交事務
        await client.query('COMMIT');
        currentTransaction = false;
        console.log('Transaction committed');

        // 6. 返回清理結果
        const response = {
            success: true,
            message: 'All logs have been cleared',
            details: {
                totalRemoved: deleteResult.rowCount,
                totalBefore: parseInt(countBefore.rows[0].count),
                totalAfter: 0,
                timestamp: new Date().toISOString()
            }
        };
        console.log('Cleanup completed successfully:', response);
        res.json(response);

    } catch (error) {
        console.error('Error in logs cleanup:', {
            error: error.message,
            stack: error.stack,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            position: error.position,
            internalPosition: error.internalPosition,
            internalQuery: error.internalQuery,
            where: error.where,
            schema: error.schema,
            table: error.table,
            column: error.column,
            dataType: error.dataType,
            constraint: error.constraint
        });

        if (currentTransaction) {
            try {
                await client.query('ROLLBACK');
                console.log('Transaction rolled back');
            } catch (rollbackError) {
                console.error('Error during rollback:', rollbackError);
            }
            currentTransaction = false;
        }

        res.status(500).json({
            success: false,
            error: error.message,
            details: {
                code: error.code,
                table: 'processing_logs',
                operation: 'clean',
                detail: error.detail,
                hint: error.hint,
                timestamp: new Date().toISOString()
            }
        });
    } finally {
        try {
            client.release();
            console.log('Database client released');
        } catch (releaseError) {
            console.error('Error releasing client:', releaseError);
        }
    }
});

// 刪除特定日誌
router.delete('/logs/:batchId', auth, deleteLog);

// 獲取同步狀態
router.post('/sync-status', auth, getSyncStatus);

module.exports = router; 