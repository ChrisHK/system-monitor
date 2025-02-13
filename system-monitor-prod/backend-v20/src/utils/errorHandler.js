/**
 * 通用錯誤處理工具
 */

// 自定義錯誤類型
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
        this.status = 400;
    }
}

class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
        this.status = 404;
    }
}

class AuthorizationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthorizationError';
        this.status = 403;
    }
}

// 通用錯誤處理函數
const handleError = (res, error) => {
    console.error('Error:', {
        name: error.name,
        message: error.message,
        stack: error.stack
    });

    // 根據錯誤類型返回適當的狀態碼
    const status = error.status || 500;
    const message = error.message || 'Internal server error';

    res.status(status).json({
        success: false,
        error: {
            message,
            code: error.name || 'INTERNAL_ERROR'
        }
    });
};

// 用於 Express 中間件的錯誤處理
const errorMiddleware = (err, req, res, next) => {
    handleError(res, err);
};

module.exports = {
    ValidationError,
    NotFoundError,
    AuthorizationError,
    handleError,
    errorMiddleware
}; 