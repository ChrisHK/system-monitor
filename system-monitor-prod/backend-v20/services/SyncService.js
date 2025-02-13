const { Pool } = require('pg');
const axios = require('axios');
const cron = require('node-cron');
const { logger } = require('../utils/logger');

class SyncService {
    constructor(config) {
        this.pool = new Pool(config.database);
        this.remoteApi = axios.create({
            baseURL: config.apiUrl,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiToken}`
            },
            timeout: 30000 // 30 seconds timeout
        });
        this.isRunning = false;
        this.currentJob = null;
    }

    async initialize() {
        try {
            // 只測試本地數據庫連接
            await this.pool.query('SELECT 1');
            logger.info('Local database connection successful');

            // 測試API連接
            await this.remoteApi.get('/health');
            logger.info('Remote API connection successful');

            return true;
        } catch (error) {
            logger.error('Initialization failed:', error);
            return false;
        }
    }

    async processPendingChanges() {
        if (this.isRunning) {
            logger.info('Sync already in progress, skipping...');
            return;
        }

        this.isRunning = true;
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // 獲取需要同步的配置
            const { rows: configs } = await client.query(`
                SELECT * FROM sync_config 
                WHERE is_enabled = true 
                AND (last_sync_at IS NULL OR 
                    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_sync_at)) >= sync_interval)
            `);

            for (const config of configs) {
                // 獲取待同步的記錄
                const { rows: changes } = await client.query(`
                    UPDATE sync_log
                    SET sync_status = 'processing'
                    WHERE id IN (
                        SELECT id FROM sync_log
                        WHERE table_name = $1
                        AND sync_status = 'pending'
                        AND (retry_count < $2 OR retry_count IS NULL)
                        ORDER BY created_at ASC
                        LIMIT $3
                        FOR UPDATE SKIP LOCKED
                    )
                    RETURNING *
                `, [config.table_name, config.max_retries, config.batch_size]);

                logger.info(`Processing ${changes.length} changes for ${config.table_name}`);

                // 批量處理變更
                if (changes.length > 0) {
                    try {
                        // 將變更分組
                        const changesByOperation = {
                            INSERT: changes.filter(c => c.operation === 'INSERT'),
                            UPDATE: changes.filter(c => c.operation === 'UPDATE'),
                            DELETE: changes.filter(c => c.operation === 'DELETE')
                        };

                        // 批量發送到遠端 API
                        await this.processBatchChanges(config.table_name, changesByOperation);

                        // 更新成功狀態
                        const successIds = changes.map(c => c.id);
                        await client.query(`
                            UPDATE sync_log 
                            SET sync_status = 'completed',
                                synced_at = CURRENT_TIMESTAMP
                            WHERE id = ANY($1)
                        `, [successIds]);

                    } catch (error) {
                        logger.error(`Failed to process batch for ${config.table_name}:`, error);

                        // 更新失敗狀態
                        const failedIds = changes.map(c => c.id);
                        await client.query(`
                            UPDATE sync_log 
                            SET sync_status = 'failed',
                                error_message = $2,
                                retry_count = COALESCE(retry_count, 0) + 1
                            WHERE id = ANY($1)
                        `, [failedIds, error.message]);
                    }
                }

                // 更新最後同步時間
                await client.query(`
                    UPDATE sync_config
                    SET last_sync_at = CURRENT_TIMESTAMP
                    WHERE table_name = $1
                `, [config.table_name]);
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Sync process failed:', error);
        } finally {
            client.release();
            this.isRunning = false;
        }
    }

    async processBatchChanges(tableName, changesByOperation) {
        const endpoint = `/sync/${tableName}/batch`;
        
        // 發送批量同步請求
        await this.remoteApi.post(endpoint, {
            inserts: changesByOperation.INSERT.map(c => c.new_data),
            updates: changesByOperation.UPDATE.map(c => ({
                id: c.record_id,
                old_data: c.old_data,
                new_data: c.new_data
            })),
            deletes: changesByOperation.DELETE.map(c => ({
                id: c.record_id,
                old_data: c.old_data
            }))
        });
    }

    async getStats(startDate, endDate) {
        const { rows } = await this.pool.query(`
            SELECT 
                table_name,
                SUM(total_records) as total_records,
                SUM(success_count) as success_count,
                SUM(failed_count) as failed_count,
                MAX(last_sync_at) as last_sync_at
            FROM sync_stats
            WHERE sync_date BETWEEN $1 AND $2
            GROUP BY table_name
        `, [startDate, endDate]);

        return rows;
    }

    async retryFailed(tableName = null) {
        const query = tableName
            ? `UPDATE sync_log 
               SET sync_status = 'pending', 
                   error_message = NULL 
               WHERE sync_status = 'failed' 
               AND table_name = $1`
            : `UPDATE sync_log 
               SET sync_status = 'pending', 
                   error_message = NULL 
               WHERE sync_status = 'failed'`;

        const params = tableName ? [tableName] : [];
        await this.pool.query(query, params);
    }

    start(cronExpression = '*/1 * * * *') {
        if (this.currentJob) {
            this.currentJob.stop();
        }

        this.currentJob = cron.schedule(cronExpression, () => {
            this.processPendingChanges()
                .catch(error => logger.error('Scheduled sync failed:', error));
        });

        logger.info(`Sync service started with schedule: ${cronExpression}`);
    }

    stop() {
        if (this.currentJob) {
            this.currentJob.stop();
            this.currentJob = null;
            logger.info('Sync service stopped');
        }
    }
}

module.exports = SyncService; 