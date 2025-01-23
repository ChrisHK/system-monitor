const pool = require('../db');

// 檢查主要權限
const checkMainPermission = (feature) => {
    return async (req, res, next) => {
        try {
            const { user } = req;

            console.log('=== Checking Main Permission ===');
            console.log('User:', { id: user.id, group: user.group_name });
            console.log('Feature:', feature);

            // 檢查用戶群組
            const groupResult = await pool.query(`
                SELECT g.name as group_name, gp.permission_value
                FROM groups g
                LEFT JOIN group_permissions gp ON g.id = gp.group_id AND gp.permission_type = $2
                WHERE g.id = $1
            `, [user.group_id, feature]);

            if (groupResult.rows.length === 0) {
                console.log('Error: User group not found');
                return res.status(403).json({
                    success: false,
                    error: 'Access denied: User group not found'
                });
            }

            const group = groupResult.rows[0];
            console.log('User group:', group);

            // 如果是admin群組，直接允許訪問
            if (group.group_name === 'admin') {
                console.log('Access granted: Admin group');
                return next();
            }

            // 檢查特定功能的權限
            if (group.permission_value === true) {
                console.log(`Access granted: Has ${feature} permission`);
                return next();
            }

            console.log(`Access denied: No ${feature} permission`);
            return res.status(403).json({
                success: false,
                error: `Access denied: No permission for ${feature}`
            });
        } catch (error) {
            console.error('Error checking main permission:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error while checking permissions',
                details: error.message
            });
        }
    };
};

// 檢查商店特定功能的權限
const checkStorePermission = (feature) => {
    return async (req, res, next) => {
        try {
            const { user } = req;
            const storeId = parseInt(req.params.storeId || req.query.storeId || req.body.storeId);

            console.log('=== Checking Store Permission ===');
            console.log('User:', { id: user.id, group: user.group_name });
            console.log('Store ID:', storeId);
            console.log('Feature:', feature);

            // 如果沒有提供商店ID，返回錯誤
            if (!storeId) {
                console.log('Error: Store ID is required');
                return res.status(400).json({
                    success: false,
                    error: 'Store ID is required'
                });
            }

            // 檢查用戶群組
            const groupResult = await pool.query(`
                SELECT g.name as group_name
                FROM groups g
                WHERE g.id = $1
            `, [user.group_id]);

            if (groupResult.rows.length === 0) {
                console.log('Error: User group not found');
                return res.status(403).json({
                    success: false,
                    error: 'Access denied: User group not found'
                });
            }

            const group = groupResult.rows[0];
            console.log('User group:', group);

            // 如果是admin群組，直接允許訪問
            if (group.group_name === 'admin') {
                console.log('Access granted: Admin group');
                return next();
            }

            // 檢查群組是否有權限訪問該商店
            const storePermissionResult = await pool.query(`
                SELECT store_id, features
                FROM group_store_permissions
                WHERE group_id = $1 AND store_id = $2
            `, [user.group_id, storeId]);

            if (storePermissionResult.rows.length === 0) {
                console.log('Store not in permitted stores list');
                return res.status(403).json({
                    success: false,
                    error: 'Access denied: Store not in permitted stores list'
                });
            }

            const storePermission = storePermissionResult.rows[0];
            console.log('Store permission:', storePermission);

            // 如果是view或basic功能，允許所有有商店權限的用戶訪問
            if (feature === 'view' || !feature || feature === 'basic') {
                console.log('Access granted: Basic view permission');
                return next();
            }

            // 檢查特定功能的權限
            const features = storePermission.features || {
                view: true,
                basic: true,
                inventory: false,
                orders: false,
                rma: false
            };

            console.log('Current features:', features);
            if (features[feature] === true) {
                console.log(`Access granted: Has ${feature} permission`);
                return next();
            }

            console.log(`Access denied: No ${feature} permission`);
            return res.status(403).json({
                success: false,
                error: `Access denied: No permission for ${feature} in this store`
            });
        } catch (error) {
            console.error('Error checking store permission:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error while checking permissions',
                details: error.message
            });
        }
    };
};

module.exports = {
    checkStorePermission,
    checkMainPermission
}; 