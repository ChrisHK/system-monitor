const jwt = require('jsonwebtoken');
const pool = require('../db');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            throw new Error('No token provided');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await pool.query(
            'SELECT users.*, roles.name as role_name FROM users JOIN roles ON users.role_id = roles.id WHERE users.id = $1 AND users.is_active = true',
            [decoded.id]
        );

        if (result.rows.length === 0) {
            throw new Error('User not found or inactive');
        }

        req.user = result.rows[0];
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            error: 'Please authenticate'
        });
    }
};

const checkRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role_name)) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        next();
    };
};

module.exports = { auth, checkRole }; 