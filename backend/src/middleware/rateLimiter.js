const rateLimit = require('express-rate-limit');

const createRateLimiter = (options = {}) => {
    return rateLimit({
        windowMs: options.windowMs || 15 * 60 * 1000, // 默認15分鐘
        max: options.max || 100, // 限制請求次數
        message: {
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests, please try again later.'
            }
        },
        standardHeaders: true, // 返回 RateLimit-* headers
        legacyHeaders: false, // 禁用 X-RateLimit-* headers
        ...options
    });
};

module.exports = { createRateLimiter }; 