const jwt = require('jsonwebtoken');
const pool = require('../db');

const auth = async (req, res, next) => {
    console.log('=== Starting Authentication ===');
    console.log('Headers:', req.headers);
    
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        console.log('Token present:', !!token);
        
        if (!token) {
            console.log('Authentication failed: No token provided');
            throw new Error('No token provided');
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            console.log('Token decoded successfully:', { userId: decoded.id });
            
            const result = await pool.query(`
                SELECT 
                    u.*,
                    g.name as group_name,
                    g.id as group_id,
                    r.name as role_name,
                    ARRAY_AGG(DISTINCT gsp.store_id) FILTER (WHERE gsp.store_id IS NOT NULL) as permitted_stores,
                    ARRAY_AGG(DISTINCT gsp.features) FILTER (WHERE gsp.features IS NOT NULL) as store_features
                FROM users u
                LEFT JOIN groups g ON u.group_id = g.id
                LEFT JOIN roles r ON u.role_id = r.id
                LEFT JOIN group_store_permissions gsp ON g.id = gsp.group_id
                WHERE u.id = $1 AND u.is_active = true
                GROUP BY u.id, g.name, g.id, r.name
            `, [decoded.id]);

            console.log('User query result rows:', result.rows.length);
            
            if (result.rows.length === 0) {
                console.log('Authentication failed: User not found or inactive');
                throw new Error('User not found or inactive');
            }

            req.user = result.rows[0];
            console.log('Authentication successful for user:', {
                id: req.user.id,
                group: req.user.group_name,
                role: req.user.role_name
            });
            
            next();
        } catch (jwtError) {
            console.error('JWT verification failed:', jwtError);
            throw new Error('Invalid token');
        }
    } catch (error) {
        console.error('=== Authentication Error ===', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        res.status(401).json({
            success: false,
            error: 'Please authenticate',
            detail: error.message
        });
    }
};

const checkGroup = (requiredGroups = [], requireStore = false) => {
    return (req, res, next) => {
        const { user } = req;
        
        // 檢查用戶是否有群組
        if (!user.group_id) {
            return res.status(403).json({
                success: false,
                error: 'Access denied: No group assigned'
            });
        }

        // 檢查群組權限
        const isAdminGroup = user.group_name === 'admin';
        const hasGroupPermission = isAdminGroup || requiredGroups.includes(user.group_name);

        // 檢查商店權限
        const hasStorePermission = !requireStore || 
            isAdminGroup || 
            (user.permitted_stores && user.permitted_stores.length > 0);

        if (!hasGroupPermission) {
            return res.status(403).json({
                success: false,
                error: 'Access denied: Insufficient group permissions'
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

module.exports = { auth, checkGroup }; 