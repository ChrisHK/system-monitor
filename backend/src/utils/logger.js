const winston = require('winston');
const path = require('path');

// 定義日誌格式
const logFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// 創建日誌目錄
const logDir = path.join(__dirname, '../../logs');

// 創建 logger 實例
const createLogger = (module) => {
    return winston.createLogger({
        format: logFormat,
        defaultMeta: { module },
        transports: [
            // 錯誤日誌
            new winston.transports.File({
                filename: path.join(logDir, 'error.log'),
                level: 'error'
            }),
            // 所有日誌
            new winston.transports.File({
                filename: path.join(logDir, 'combined.log')
            }),
            // 開發環境下輸出到控制台
            ...(process.env.NODE_ENV !== 'production' ? [
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.simple()
                    )
                })
            ] : [])
        ]
    });
};

module.exports = {
    createLogger
}; 