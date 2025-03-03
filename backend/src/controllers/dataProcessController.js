const pool = require('../db');
const { createLogger } = require('../utils/logger');
const ChecksumCalculator = require('../utils/checksumCalculator');
const logger = createLogger('data-processing');

// 添加處理狀態常量
const PROCESSING_STATUS = {
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    COMPLETED_WITH_ERRORS: 'completed_with_errors',
    FAILED: 'failed'
};

// 處理時間戳和時區
const ensureTimestamp = (timestamp) => {
    if (!timestamp) {
        return new Date().toISOString();
    }
    try {
        // 解析 ISO 格式的時間戳
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            throw new Error('Invalid timestamp');
        }
        // 如果時間戳沒有時區信息，假定為 UTC
        return date.toISOString();
    } catch (error) {
        logger.warn('Invalid timestamp format, using current time:', {
            original: timestamp,
            error: error.message
        });
        return new Date().toISOString();
    }
};

// 確保數值為有效的數字
const ensureNumeric = (value, defaultValue = 0) => {
    if (value === null || value === undefined) {
        return defaultValue;
    }
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
};

// 處理磁盤數據的輔助函數
const formatDisks = (disksData) => {
    try {
        // 如果是 null 或 undefined，返回 null
        if (disksData === null || disksData === undefined) {
            return null;
        }

        // 如果是字符串，直接返回
        if (typeof disksData === 'string') {
            return disksData;
        }

        // 如果是數字，轉換為字符串
        if (typeof disksData === 'number') {
            return String(disksData);
        }

        // 如果是數組，轉換為字符串
        if (Array.isArray(disksData)) {
            return String(disksData);
        }

        // 其他情況返回原始值的字符串形式
        return String(disksData);
    } catch (error) {
        logger.error('Error formatting disks:', {
            error: error.message,
            disksData
        });
        return null;
    }
};

// 計算總磁盤容量
const calculateTotalDisksGB = (disksData) => {
    try {
        // 如果是數字，直接返回
        if (typeof disksData === 'number') {
            return disksData;
        }

        // 如果提供了 disks_gb，優先使用
        if (disksData && typeof disksData === 'object' && 'disks_gb' in disksData) {
            return parseFloat(disksData.disks_gb) || 0;
        }

        // 其他情況返回 0
        return 0;
    } catch (error) {
        logger.error('Error calculating total disks GB:', {
            error: error.message,
            disksData
        });
        return 0;
    }
};

// 處理 touchscreen 值的輔助函數
const formatTouchscreen = (value) => {
    if (value === 'Yes' || value === 'Yes Detected') {
        return 'Yes';
    }
    return 'No';
};

// Process inventory data
const processInventoryData = async (req, res) => {
    const client = await pool.connect();
    let currentTransaction = false;
    let processingLogId = null;

    try {
        const { source, batch_id, items, metadata } = req.body;

        // 1. 驗證輸入數據
        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('Invalid items data');
        }

        // 2. 創建處理日誌
        const logResult = await client.query(`
            INSERT INTO processing_logs (
                batch_id,
                source,
                status,
                total_items,
                started_at
            ) VALUES ($1, $2, $3::processing_status, $4, NOW())
            RETURNING id
        `, [batch_id, source, 'processing', items.length]);

        processingLogId = logResult.rows[0].id;

        // 3. 開始事務
        await client.query('BEGIN');
        currentTransaction = true;

        // 4. 設置事務隔離級別和超時
        await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        await client.query('SET statement_timeout = 300000'); // 5 minutes

        // 5. 處理每個項目
        let processedCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const item of items) {
            try {
                // 使用簡單的 INSERT,自動獲取下一個 ID
                const result = await client.query(`
                    WITH next_id AS (
                        SELECT COALESCE(MAX(id), 0) + 1 as next_id 
                        FROM system_records
                    )
                    INSERT INTO system_records (
                        id, serialnumber, computername, manufacturer, model,
                        systemsku, operatingsystem, cpu, resolution,
                        graphicscard, touchscreen, ram_gb, disks,
                        design_capacity, full_charge_capacity, cycle_count,
                        battery_health, is_current, created_at, data_source,
                        outbound_status, sync_status, validation_status
                    ) 
                    SELECT 
                        next_id, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                        $13, $14, $15, $16, true, COALESCE($17, NOW()), $18,
                        $19, $20, $21
                    FROM next_id
                    RETURNING id, serialnumber
                `, [
                    item.serialnumber,
                    item.computername || '',
                    item.manufacturer || '',
                    item.model || '',
                    item.systemsku || '',
                    item.operatingsystem || '',
                    item.cpu || '',
                    item.resolution || '',
                    item.graphicscard || '',
                    formatTouchscreen(item.touchscreen),
                    parseFloat(item.ram_gb) || 0,
                    item.disks || '',
                    parseInt(item.design_capacity) || 0,
                    parseInt(item.full_charge_capacity) || 0,
                    parseInt(item.cycle_count) || 0,
                    parseFloat(item.battery_health) || 0,
                    item.created_at,
                    item.data_source || source,
                    item.outbound_status || 'pending',
                    item.sync_status || 'pending',
                    item.validation_status || 'pending'
                ]);

                if (result.rows.length > 0) {
                    processedCount++;
                    console.log('Processed record:', {
                        id: result.rows[0].id,
                        serialnumber: result.rows[0].serialnumber,
                        operation: 'insert'
                    });
                }
            } catch (itemError) {
                errorCount++;
                const errorDetail = {
                    serialnumber: item.serialnumber,
                    error: itemError.message,
                    code: itemError.code,
                    detail: itemError.detail
                };
                errors.push(errorDetail);
                console.error('Error processing item:', errorDetail);
            }
        }

        // 6. 提交事務
        await client.query('COMMIT');
        currentTransaction = false;

        // 7. 更新處理日誌
        const status = errorCount > 0 ? 'completed_with_errors' : 'completed';
        await client.query(`
            UPDATE processing_logs 
            SET 
                status = $1::processing_status,
                processed_count = $2,
                error_count = $3,
                errors = $4,
                completed_at = NOW()
            WHERE id = $5
        `, [status, processedCount, errorCount, JSON.stringify(errors), processingLogId]);

        // 8. 返回結果
        res.json({
            success: true,
            status: status,
            details: {
                batch_id,
                processed: processedCount,
                errors: errorCount,
                processingLogId,
                error_details: errors
            }
        });

    } catch (error) {
        console.error('Error in processInventoryData:', {
            error: error.message,
            stack: error.stack,
            processingLogId
        });

        if (currentTransaction) {
            try {
                await client.query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Error during rollback:', rollbackError);
            }
            currentTransaction = false;
        }

        // 更新錯誤狀態
        if (processingLogId) {
            try {
                await client.query(`
                    UPDATE processing_logs 
                    SET 
                        status = $1::processing_status,
                        error_message = $2,
                        error_count = 1,
                        errors = $3,
                        completed_at = NOW()
                    WHERE id = $4
                `, ['failed', error.message, JSON.stringify([{
                    error: error.message,
                    code: error.code,
                    detail: error.detail
                }]), processingLogId]);
            } catch (updateError) {
                console.error('Error updating processing log:', updateError);
            }
        }

        res.status(500).json({
            success: false,
            error: 'Failed to process inventory data',
            details: {
                message: error.message,
                code: error.code,
                processingLogId
            }
        });
    } finally {
        try {
            await client.query('RESET statement_timeout');
        } catch (resetError) {
            console.error('Error resetting timeout:', resetError);
        }
        client.release();
    }
};

// Get processing logs
const getLogs = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT 
                id,
                batch_id,
                source,
                status::text,
                total_items,
                processed_count,
                error_count,
                started_at,
                completed_at,
                error_message,
                errors
            FROM processing_logs 
            ORDER BY started_at DESC
        `);

        res.json({
            success: true,
            logs: result.rows
        });
    } catch (error) {
        console.error('Error getting logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get logs'
        });
    } finally {
        client.release();
    }
};

// Get processing status
const getProcessingStatus = async (req, res) => {
    try {
        const { batchId } = req.params;
        const result = await pool.query(
            `SELECT 
                id, batch_id, source, status,
                total_items, processed_count, error_count,
                started_at, completed_at, error_message,
                errors
            FROM processing_logs
            WHERE batch_id = $1`,
            [batchId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Batch not found'
            });
        }

        res.json({
            success: true,
            status: result.rows[0]
        });
    } catch (error) {
        logger.error('Error fetching status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch status'
        });
    }
};

// Clear logs
const clearLogs = async (req, res) => {
    let client = null;
    let transactionActive = false;

    try {
        client = await pool.connect();
        
        // 開始新事務
        await client.query('BEGIN');
        transactionActive = true;

        // 先檢查是否有需要歸檔的日誌
        const checkResult = await client.query(`
            SELECT COUNT(*) as count
            FROM processing_logs
            WHERE completed_at < NOW() - INTERVAL '30 days'
        `);

        if (parseInt(checkResult.rows[0].count) === 0) {
            await client.query('COMMIT');
            transactionActive = false;
            return res.json({
                success: true,
                cleared: 0,
                message: 'No logs to archive'
            });
        }

        // 歸檔舊日誌
        const archiveResult = await client.query(`
            WITH moved_rows AS (
                INSERT INTO processing_logs_archive (
                    original_id, batch_id, source, status,
                    total_items, processed_count, error_count,
                    errors, error_message, started_at,
                    completed_at, created_at, archived_at
                )
                SELECT 
                    id, batch_id, source, status,
                    total_items, processed_count, error_count,
                    errors, error_message, started_at,
                    completed_at, created_at, NOW()
                FROM processing_logs
                WHERE completed_at < NOW() - INTERVAL '30 days'
                RETURNING id
            )
            SELECT COUNT(*) as count FROM moved_rows
        `);

        // 刪除已歸檔的日誌
        await client.query(`
            DELETE FROM processing_logs
            WHERE completed_at < NOW() - INTERVAL '30 days'
        `);

        await client.query('COMMIT');
        transactionActive = false;

        res.json({
            success: true,
            cleared: parseInt(archiveResult.rows[0].count),
            message: `${archiveResult.rows[0].count} logs archived successfully`
        });

    } catch (error) {
        logger.error('Error clearing logs:', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        try {
            if (client && transactionActive) {
                await client.query('ROLLBACK');
                transactionActive = false;
            }
        } catch (rollbackError) {
            logger.error('Rollback failed during log clearing:', {
                error: rollbackError.message,
                originalError: error.message,
                timestamp: new Date().toISOString()
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to clear logs',
            details: error.message
        });

    } finally {
        if (client) {
            try {
                if (transactionActive) {
                    await client.query('ROLLBACK');
                }
            } catch (finalError) {
                logger.error('Final rollback failed during log clearing:', finalError);
            }
            client.release();
        }
    }
};

// Delete specific log
const deleteLog = async (req, res) => {
    const { batchId } = req.params;
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Check if log exists
        const checkResult = await client.query(
            'SELECT id FROM processing_logs WHERE batch_id = $1',
            [batchId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Log record not found'
            });
        }

        // Delete the log
        await client.query(
            'DELETE FROM processing_logs WHERE batch_id = $1',
            [batchId]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Log record deleted successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error deleting log:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete log record'
        });
    } finally {
        client.release();
    }
};

// Get sync status
const getSyncStatus = async (req, res) => {
    try {
        const { serialnumbers } = req.body;
        
        if (!Array.isArray(serialnumbers)) {
            return res.status(400).json({
                success: false,
                error: 'serialnumbers must be an array'
            });
        }

        const result = await pool.query(
            `SELECT 
                serialnumber,
                sync_status,
                sync_version,
                last_sync_time,
                is_current
            FROM system_records 
            WHERE serialnumber = ANY($1)
            ORDER BY serialnumber, created_at DESC`,
            [serialnumbers]
        );

        // 組織返回數據
        const statusMap = {};
        for (const record of result.rows) {
            if (!statusMap[record.serialnumber] || record.is_current) {
                statusMap[record.serialnumber] = {
                    sync_status: record.sync_status,
                    sync_version: record.sync_version,
                    last_sync_time: record.last_sync_time
                };
            }
        }

        res.json({
            success: true,
            statuses: statusMap
        });
    } catch (error) {
        logger.error('Error getting sync status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get sync status'
        });
    }
};

module.exports = {
    PROCESSING_STATUS,
    processInventoryData,
    getLogs,
    getProcessingStatus,
    clearLogs,
    deleteLog,
    getSyncStatus
}; 