require('dotenv').config();
const SyncService = require('../services/SyncService');
const { logger } = require('../utils/logger');

// 同步服務配置
const config = {
    database: {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
        ssl: process.env.DB_SSL === 'true'
    },
    apiUrl: process.env.SYNC_API_URL || 'https://erp.zerounique.com/api',
    apiToken: process.env.SYNC_API_TOKEN
};

// 創建同步服務實例
const syncService = new SyncService(config);

// 處理進程信號
process.on('SIGTERM', () => {
    logger.info('Received SIGTERM signal');
    syncService.stop();
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('Received SIGINT signal');
    syncService.stop();
    process.exit(0);
});

// 啟動同步服務
async function start() {
    try {
        // 初始化服務
        const initialized = await syncService.initialize();
        if (!initialized) {
            logger.error('Failed to initialize sync service');
            process.exit(1);
        }

        // 設置同步間隔（默認每分鐘）
        const cronExpression = process.env.SYNC_CRON || '*/1 * * * *';
        syncService.start(cronExpression);

        logger.info('Sync service started successfully');
        logger.info(`Sync schedule: ${cronExpression}`);
    } catch (error) {
        logger.error('Failed to start sync service:', error);
        process.exit(1);
    }
}

start(); 