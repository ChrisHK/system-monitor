const pool = require('../db');
const { createLogger } = require('../utils/logger');
const ChecksumCalculator = require('../utils/checksumCalculator');
const logger = createLogger('data-processing');

// Process inventory data
const processInventoryData = async (req, res) => {
    let client = null;
    let logId = null;
    let transactionActive = false;
    
    try {
        const { items, metadata, source, timestamp, batch_id } = req.body;
        
        // 記錄請求數據
        logger.info('Processing inventory data:', {
            batch_id,
            source,
            itemCount: items.length,
            checksum: metadata.checksum,
            timestamp: new Date().toISOString()
        });

        client = await pool.connect();

        // 開始新事務
        await client.query('BEGIN');
        transactionActive = true;

        // 創建處理日誌條目
        const logEntry = await client.query(
            `INSERT INTO processing_logs 
            (batch_id, source, total_items, status, started_at) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING id`,
            [batch_id, source, items.length, 'processing', timestamp]
        );

        logId = logEntry.rows[0].id;
        let processedCount = 0;
        let errorCount = 0;
        const errors = [];

        // 處理每個項目
        for (const item of items) {
            try {
                // 規範化項目數據
                const normalizedItem = ChecksumCalculator.normalizeItem(item);

                console.log('Processing item:', {
                    original: item,
                    normalized: normalizedItem,
                    timestamp: new Date().toISOString()
                });

                // 檢查項目是否存在
                const existingItem = await client.query(
                    'SELECT id FROM system_records WHERE serialnumber = $1 FOR UPDATE',
                    [normalizedItem.serialnumber]
                );

                console.log('Existing item check:', {
                    serialnumber: normalizedItem.serialnumber,
                    exists: existingItem.rows.length > 0,
                    timestamp: new Date().toISOString()
                });

                // 先將所有相同序號的記錄設置為非當前
                const updateResult = await client.query(
                    `UPDATE system_records 
                    SET is_current = false 
                    WHERE serialnumber = $1
                    RETURNING *`,
                    [normalizedItem.serialnumber]
                );

                console.log('Update old records result:', {
                    serialnumber: normalizedItem.serialnumber,
                    updatedCount: updateResult.rowCount,
                    timestamp: new Date().toISOString()
                });

                if (existingItem.rows.length > 0) {
                    // 更新現有項目並設置為當前
                    const updateResult = await client.query(
                        `UPDATE system_records 
                        SET 
                            computername = $1,
                            manufacturer = $2,
                            model = $3,
                            ram_gb = $4,
                            disks = $5,
                            systemsku = $6,
                            operatingsystem = $7,
                            cpu = $8,
                            resolution = $9,
                            graphicscard = $10,
                            touchscreen = $11,
                            battery_health = $12,
                            cycle_count = $13,
                            design_capacity = $14,
                            full_charge_capacity = $15,
                            is_current = true
                        WHERE id = $16
                        RETURNING *`,
                        [
                            item.computername,
                            item.manufacturer,
                            item.model,
                            item.ram_gb,
                            JSON.stringify(item.disks),
                            item.systemsku,
                            item.operatingsystem,
                            item.cpu,
                            item.resolution,
                            item.graphicscard,
                            item.touchscreen,
                            item.battery_health,
                            item.cycle_count,
                            item.design_capacity,
                            item.full_charge_capacity,
                            existingItem.rows[0].id
                        ]
                    );

                    console.log('Update result:', {
                        serialnumber: normalizedItem.serialnumber,
                        success: updateResult.rows.length > 0,
                        record: updateResult.rows[0],
                        timestamp: new Date().toISOString()
                    });
                } else {
                    // 插入新項目並設置為當前
                    const insertResult = await client.query(
                        `INSERT INTO system_records (
                            serialnumber, computername, manufacturer, model,
                            ram_gb, disks, systemsku, operatingsystem,
                            cpu, resolution, graphicscard, touchscreen,
                            battery_health, cycle_count, design_capacity,
                            full_charge_capacity, is_current
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                        RETURNING *`,
                        [
                            normalizedItem.serialnumber,
                            item.computername,
                            item.manufacturer,
                            item.model,
                            item.ram_gb,
                            JSON.stringify(item.disks),
                            item.systemsku,
                            item.operatingsystem,
                            item.cpu,
                            item.resolution,
                            item.graphicscard,
                            item.touchscreen,
                            item.battery_health,
                            item.cycle_count,
                            item.design_capacity,
                            item.full_charge_capacity,
                            true
                        ]
                    );

                    console.log('Insert result:', {
                        serialnumber: normalizedItem.serialnumber,
                        success: insertResult.rows.length > 0,
                        record: insertResult.rows[0],
                        timestamp: new Date().toISOString()
                    });
                }

                processedCount++;
            } catch (itemError) {
                errorCount++;
                errors.push({
                    serialnumber: item.serialnumber,
                    error: itemError.message
                });
                logger.error('Error processing item:', {
                    serialnumber: item.serialnumber,
                    error: itemError.message,
                    stack: itemError.stack,
                    timestamp: new Date().toISOString()
                });
            }
        }

        // 更新處理日誌
        await client.query(
            `UPDATE processing_logs 
            SET 
                status = $1,
                processed_count = $2,
                error_count = $3,
                errors = $4,
                completed_at = NOW()
            WHERE id = $5`,
            [
                errorCount === items.length ? 'failed' : 
                errorCount > 0 ? 'completed_with_errors' : 'completed',
                processedCount,
                errorCount,
                JSON.stringify(errors),
                logId
            ]
        );

        await client.query('COMMIT');
        transactionActive = false;

        res.json({
            success: true,
            batch_id,
            processed: processedCount,
            errors: errorCount,
            details: errors
        });

    } catch (error) {
        logger.error('Processing failed:', {
            error: error.message,
            stack: error.stack,
            batchId: req.body?.batch_id,
            timestamp: new Date().toISOString()
        });

        try {
            if (client && transactionActive) {
                await client.query('ROLLBACK');
                transactionActive = false;
            }

            // 如果有 logId，在新事務中更新日誌狀態
            if (logId && client) {
                await client.query('BEGIN');
                transactionActive = true;
                
                await client.query(
                    `UPDATE processing_logs 
                    SET 
                        status = 'failed',
                        error_message = $1,
                        completed_at = NOW()
                    WHERE id = $2`,
                    [error.message, logId]
                );
                
                await client.query('COMMIT');
                transactionActive = false;
            }
        } catch (updateError) {
            logger.error('Failed to update log status:', {
                error: updateError.message,
                originalError: error.message,
                timestamp: new Date().toISOString()
            });
            
            if (client && transactionActive) {
                try {
                    await client.query('ROLLBACK');
                } catch (rollbackError) {
                    logger.error('Rollback failed:', rollbackError);
                }
            }
        }

        res.status(500).json({
            success: false,
            error: 'Processing failed',
            details: error.message
        });
    } finally {
        if (client) {
            try {
                if (transactionActive) {
                    await client.query('ROLLBACK');
                }
            } catch (finalError) {
                logger.error('Final rollback failed:', finalError);
            }
            client.release();
        }
    }
};

// Get processing logs
const getLogs = async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                id, batch_id, source, status,
                total_items, processed_count, error_count,
                started_at, completed_at, error_message,
                errors
            FROM processing_logs
        `;

        const params = [];
        if (status) {
            query += ` WHERE status = $1`;
            params.push(status);
        }

        query += ` ORDER BY started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await pool.query(query, params);

        // Get total count
        const countQuery = 'SELECT COUNT(*) FROM processing_logs' + (status ? ' WHERE status = $1' : '');
        const countResult = await pool.query(countQuery, status ? [status] : []);

        res.json({
            success: true,
            logs: result.rows,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
        });
    } catch (error) {
        logger.error('Error fetching logs:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch logs'
        });
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

module.exports = {
    processInventoryData,
    getLogs,
    getProcessingStatus,
    clearLogs,
    deleteLog
}; 