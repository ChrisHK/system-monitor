const ChecksumCalculator = require('../utils/checksumCalculator');
const { createLogger } = require('../utils/logger');
const logger = createLogger('checksum-validator');

/**
 * Checksum 驗證中間件
 */
const checksumValidator = async (req, res, next) => {
    try {
        const { items, metadata } = req.body;

        // 檢查必需的字段
        if (!items || !metadata || !metadata.checksum) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: items and metadata.checksum'
            });
        }

        // 記錄接收到的數據
        logger.debug('Received request data:', {
            itemCount: items.length,
            providedChecksum: metadata.checksum,
            firstItem: items[0],  // 記錄第一個項目的內容
            timestamp: new Date().toISOString()
        });

        // 計算新的 checksum 並記錄
        const calculatedChecksum = ChecksumCalculator.calculate(items);
        logger.debug('Checksum comparison:', {
            provided: metadata.checksum,
            calculated: calculatedChecksum,
            match: metadata.checksum === calculatedChecksum,
            timestamp: new Date().toISOString()
        });

        // 驗證 checksum
        const isValid = metadata.checksum === calculatedChecksum;

        if (!isValid) {
            logger.error('Checksum validation failed:', {
                providedChecksum: metadata.checksum,
                calculatedChecksum: calculatedChecksum,
                firstItem: items[0],
                timestamp: new Date().toISOString()
            });

            return res.status(400).json({
                success: false,
                error: 'Checksum validation failed',
                details: {
                    provided: metadata.checksum,
                    calculated: calculatedChecksum
                }
            });
        }

        // 驗證通過，繼續處理
        next();

    } catch (error) {
        logger.error('Error in checksum validation:', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        res.status(400).json({
            success: false,
            error: 'Checksum validation error',
            details: error.message
        });
    }
};

module.exports = checksumValidator; 