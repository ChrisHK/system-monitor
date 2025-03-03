const { Pool } = require('pg');
const path = require('path');
const moment = require('moment');

// 加載環境變量
const env = process.env.NODE_ENV || 'development';
require('dotenv').config({
    path: path.join(__dirname, `../../.env.${env}`)
});

// 創建數據庫連接池
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    // 連接池設置
    max: 1, // 為了避免並發問題，這裡只使用一個連接
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

async function cleanLogs(options = {}) {
    const {
        dryRun = false,           // 是否只是模擬運行
        force = false,            // 是否強制清理
        days = 30,               // 清理多少天前的日誌
        batchSize = 100,         // 每批處理的數量
        logStatus = null         // 指定要清理的狀態
    } = options;

    const client = await pool.connect();
    let totalArchived = 0;
    let totalDeleted = 0;

    try {
        console.log('Starting log cleanup process...');
        console.log('Options:', {
            dryRun,
            force,
            days,
            batchSize,
            logStatus,
            timestamp: new Date().toISOString()
        });

        // 開始事務
        if (!dryRun) {
            await client.query('BEGIN');
        }

        // 構建查詢條件
        let whereClause = 'WHERE completed_at < NOW() - INTERVAL $1';
        const params = [`${days} days`];
        
        if (logStatus) {
            whereClause += ' AND status = $2';
            params.push(logStatus);
        }

        // 獲取需要處理的記錄總數
        const countResult = await client.query(
            `SELECT COUNT(*) as count FROM processing_logs ${whereClause}`,
            params
        );
        const totalCount = parseInt(countResult.rows[0].count);

        console.log(`Found ${totalCount} logs to process`);

        if (totalCount === 0) {
            console.log('No logs to clean up');
            if (!dryRun) {
                await client.query('COMMIT');
            }
            return {
                success: true,
                archived: 0,
                deleted: 0,
                message: 'No logs to clean up'
            };
        }

        // 如果不是強制模式且記錄數量很大，提供警告
        if (!force && totalCount > 1000) {
            console.warn(`Warning: Large number of logs (${totalCount}) to process. Use force option to proceed.`);
            if (!dryRun) {
                await client.query('ROLLBACK');
            }
            return {
                success: false,
                error: 'Too many logs to process. Use force option to proceed.'
            };
        }

        // 分批處理記錄
        let processedCount = 0;
        while (processedCount < totalCount) {
            // 獲取一批要處理的記錄
            const batchResult = await client.query(
                `SELECT id, batch_id, source, status,
                        total_items, processed_count, error_count,
                        errors, error_message, started_at,
                        completed_at, created_at
                 FROM processing_logs ${whereClause}
                 ORDER BY completed_at ASC
                 LIMIT $${params.length + 1}`,
                [...params, batchSize]
            );

            if (batchResult.rows.length === 0) break;

            if (!dryRun) {
                // 歸檔記錄
                const archiveResult = await client.query(
                    `INSERT INTO processing_logs_archive (
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
                    WHERE id = ANY($1)
                    RETURNING id`,
                    [batchResult.rows.map(row => row.id)]
                );

                totalArchived += archiveResult.rows.length;

                // 刪除已歸檔的記錄
                const deleteResult = await client.query(
                    'DELETE FROM processing_logs WHERE id = ANY($1)',
                    [batchResult.rows.map(row => row.id)]
                );

                totalDeleted += deleteResult.rowCount;
            }

            processedCount += batchResult.rows.length;
            console.log(`Processed ${processedCount}/${totalCount} logs`);

            // 如果不是 dryRun，每批次提交一次
            if (!dryRun) {
                await client.query('COMMIT');
                await client.query('BEGIN');
            }
        }

        if (!dryRun) {
            await client.query('COMMIT');
        }

        const result = {
            success: true,
            dryRun,
            totalCount,
            archived: totalArchived,
            deleted: totalDeleted,
            timestamp: new Date().toISOString()
        };

        console.log('Cleanup completed:', result);
        return result;

    } catch (error) {
        console.error('Error during cleanup:', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        if (!dryRun) {
            await client.query('ROLLBACK');
        }

        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    } finally {
        client.release();
    }
}

// 命令行參數處理
const args = process.argv.slice(2);
const options = {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    days: parseInt(args.find(arg => arg.startsWith('--days='))?.split('=')[1] || '30'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '100'),
    logStatus: args.find(arg => arg.startsWith('--status='))?.split('=')[1]
};

// 運行清理
if (require.main === module) {
    cleanLogs(options)
        .then(result => {
            console.log('Cleanup result:', result);
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Cleanup failed:', error);
            process.exit(1);
        })
        .finally(() => {
            pool.end();
        });
}

module.exports = cleanLogs; 