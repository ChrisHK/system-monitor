const { AppError, ValidationError, AuthenticationError } = require('./errorTypes');

// Development環境下的錯誤處理
const sendErrorDev = (err, res) => {
    res.status(err.statusCode || 500).json({
        success: false,
        error: {
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        }
    });
};

// Production環境下的錯誤處理
const sendErrorProd = (err, res) => {
    // 可操作的、已知的錯誤
    if (err.isOperational) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.errorCode,
                message: err.message
            }
        });
    } 
    // 程序錯誤
    else {
        console.error('ERROR 💥', err);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Something went wrong'
            }
        });
    }
};

// 處理特定類型的錯誤
const handleJWTError = () => 
    new AppError('Invalid token. Please log in again.', 401, 'INVALID_TOKEN');

const handleJWTExpiredError = () => 
    new AppError('Your token has expired. Please log in again.', 401, 'EXPIRED_TOKEN');

const handleDBError = (err) => {
    if (err.code === '23505') { // Unique violation
        return new AppError('Duplicate field value', 400, 'DUPLICATE_FIELD');
    }
    return err;
};

// 主要錯誤處理中間件
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
    } else {
        let error = { ...err };
        error.message = err.message;

        if (err.name === 'JsonWebTokenError') error = handleJWTError();
        if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();
        if (err.code && err.code.startsWith('23')) error = handleDBError(err);

        sendErrorProd(error, res);
    }
};

// 異步錯誤處理包裝器
const catchAsync = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((error) => {
            console.error('Error caught by catchAsync:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });

            if (error instanceof ValidationError) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }

            if (error instanceof AuthenticationError) {
                return res.status(401).json({
                    success: false,
                    error: error.message
                });
            }

            // 未知錯誤
            console.error('Unhandled error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                detail: error.message
            });
        });
    };
};

module.exports = {
    errorHandler,
    catchAsync
}; 