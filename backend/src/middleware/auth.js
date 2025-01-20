const jwt = require('jsonwebtoken');
const pool = require('../db');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            throw new Error('No token provided');
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await pool.query(`
            SELECT 
                u.*,
                r.name as role_name,
                g.name as group_name,
                g.id as group_id,
                ARRAY_AGG(DISTINCT gsp.store_id) FILTER (WHERE gsp.store_id IS NOT NULL) as permitted_stores
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN groups g ON u.group_id = g.id
            LEFT JOIN group_store_permissions gsp ON g.id = gsp.group_id
            WHERE u.id = $1 AND u.is_active = true
            GROUP BY u.id, r.name, g.name, g.id
        `, [decoded.id]);

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

const checkRole = (roles, requireStore = false) => {
    return (req, res, next) => {
        // Check role permission
        const hasRolePermission = roles.includes(req.user.role_name);
        
        // Check group permission (admin group has all permissions)
        const hasGroupPermission = req.user.group_name === 'admin';
        
        // Check store permissions if required
        // Allow access if:
        // 1. Store permission is not required, or
        // 2. User is in admin group, or
        // 3. User has store permissions, or
        // 4. User has the required role (this allows users to at least view inventory)
        const hasStorePermission = !requireStore || 
            hasGroupPermission || 
            (req.user.permitted_stores && req.user.permitted_stores.length > 0) ||
            hasRolePermission;
        
        if (!hasRolePermission && !hasGroupPermission) {
            return res.status(403).json({
                success: false,
                error: 'Access denied: Insufficient role permissions'
            });
        }

        if (requireStore && !hasStorePermission) {
            return res.status(403).json({
                success: false,
                error: 'Access denied: No store permissions'
            });
        }

        next();
    };
};

module.exports = { auth, checkRole }; 