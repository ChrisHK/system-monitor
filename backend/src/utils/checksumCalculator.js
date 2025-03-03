const crypto = require('crypto');
const { createLogger } = require('./logger');
const logger = createLogger('checksum-calculator');

class ChecksumCalculator {
    /**
     * 計算庫存項目的 checksum（只使用 serialnumber）
     * @param {Array} items - 庫存項目數組
     * @returns {string} - SHA-256 checksum
     */
    static calculate(items) {
        try {
            // 1. 驗證輸入
            if (!Array.isArray(items)) {
                throw new Error('Input must be an array');
            }

            // 2. 格式化並排序項目
            const normalizedItems = items
                .map(item => this.normalizeItem(item))
                .sort((a, b) => a.serialnumber.localeCompare(b.serialnumber));

            logger.debug('Processing items:', {
                count: items.length,
                normalizedItems: JSON.stringify(normalizedItems, null, 2)
            });

            // 3. 序列化為 JSON 字符串
            const jsonString = JSON.stringify(normalizedItems);
            
            logger.debug('JSON string for checksum:', {
                string: jsonString,
                length: jsonString.length
            });

            // 4. 計算 SHA-256
            const checksum = crypto
                .createHash('sha256')
                .update(jsonString, 'utf8')
                .digest('hex');

            logger.debug('Checksum calculated:', {
                checksum,
                jsonString
            });

            return checksum;

        } catch (error) {
            logger.error('Checksum calculation failed:', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }

    /**
     * 規範化單個庫存項目（只保留 serialnumber）
     * @param {Object} item - 庫存項目
     * @returns {Object} - 只包含 serialnumber 的對象
     */
    static normalizeItem(item) {
        // Only keep serialnumber
        return {
            serialnumber: String(item.serialnumber || '')
        };
    }

    /**
     * 驗證 checksum
     * @param {Array} items - 庫存項目數組
     * @param {string} providedChecksum - 提供的 checksum
     * @returns {boolean} - 驗證結果
     */
    static verify(items, providedChecksum) {
        try {
            const calculatedChecksum = this.calculate(items);
            const isValid = calculatedChecksum === providedChecksum;
            
            logger.debug('Checksum verification:', {
                provided: providedChecksum,
                calculated: calculatedChecksum,
                isValid,
                normalizedItems: JSON.stringify(items.map(item => this.normalizeItem(item)), null, 2)
            });

            return isValid;
        } catch (error) {
            logger.error('Checksum verification failed:', {
                error: error.message,
                stack: error.stack
            });
            return false;
        }
    }
}

module.exports = ChecksumCalculator; 