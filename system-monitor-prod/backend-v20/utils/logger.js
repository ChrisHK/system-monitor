const winston = require('winston');
const path = require('path');

// 定義日誌格式
const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack }) => {
        return `${timestamp} ${level.toUpperCase()}: ${message}${stack ? '\n' + stack : ''}`;
    })
);

// 創建日誌記錄器
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    transports: [
        // 控制台輸出
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                logFormat
            )
        }),
        // 文件輸出
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/sync.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    ]
});

// 如果不是生產環境，則設置更詳細的日誌級別
if (process.env.NODE_ENV !== 'production') {
    logger.level = 'debug';
}

module.exports = {
    logger,
    // 創建一個特定模塊的日誌記錄器
    createLogger: (module) => {
        return {
            info: (message, meta = {}) => {
                logger.info(`[${module}] ${message}`, meta);
            },
            error: (message, meta = {}) => {
                logger.error(`[${module}] ${message}`, meta);
            },
            warn: (message, meta = {}) => {
                logger.warn(`[${module}] ${message}`, meta);
            },
            debug: (message, meta = {}) => {
                logger.debug(`[${module}] ${message}`, meta);
            }
        };
    }
}; 