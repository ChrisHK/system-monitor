const { body, validationResult } = require('express-validator');
const ChecksumCalculator = require('../utils/checksumCalculator');

// Validate data processing request
const validateDataProcessing = [
    // Basic request structure validation
    body('source').notEmpty().withMessage('Source is required'),
    body('timestamp')
        .notEmpty().withMessage('Timestamp is required')
        .isISO8601().withMessage('Invalid timestamp format'),
    body('batch_id').notEmpty().withMessage('Batch ID is required'),
    body('items').isArray().withMessage('Items must be an array'),
    body('metadata').isObject().withMessage('Metadata is required'),
    body('metadata.total_items').isInt().withMessage('Total items count is required'),
    body('metadata.version').notEmpty().withMessage('Version is required'),
    body('metadata.checksum').notEmpty().withMessage('Checksum is required'),

    // Items validation - only require serialnumber
    body('items.*.serialnumber').notEmpty().withMessage('Serial number is required'),
    
    // Custom validation for checksum
    async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        // Verify checksum using ChecksumCalculator
        const { items, metadata } = req.body;
        const calculatedChecksum = ChecksumCalculator.calculate(items);

        if (calculatedChecksum !== metadata.checksum) {
            return res.status(400).json({
                success: false,
                error: 'Invalid checksum',
                details: {
                    provided: metadata.checksum,
                    calculated: calculatedChecksum
                }
            });
        }

        next();
    }
];

module.exports = {
    validateDataProcessing
}; 