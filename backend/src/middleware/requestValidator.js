const { validationResult } = require('express-validator');

const validateRequest = (schema) => {
    return async (req, res, next) => {
        try {
            // 使用 schema 驗證請求數據
            const { error, value } = await schema.validate(req.body, {
                abortEarly: false,  // 收集所有錯誤
                stripUnknown: true  // 移除未定義的字段
            });

            if (error) {
                return res.status(400).json({
                    success: false,
                    errors: error.details.map(err => ({
                        field: err.path.join('.'),
                        message: err.message
                    }))
                });
            }

            // 將驗證後的數據賦值回請求對象
            req.validatedBody = value;
            next();
        } catch (err) {
            next(err);
        }
    };
};

module.exports = { validateRequest }; 