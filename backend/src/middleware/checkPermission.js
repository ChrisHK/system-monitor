const pool = require('../db');
const cacheService = require('../services/cacheService');

// 檢查主要權限
const checkMainPermission = (feature) => {
    return async (req, res, next) => {
        try {
            const { user } = req;

            console.log('=== Checking Main Permission ===');
            console.log('User:', { id: user.id, group: user.group_name });
            console.log('Feature:', feature);

            // 如果是admin群組，直接允許訪問
            if (user.group_name === 'admin') {
                console.log('Access granted: Admin group');
                return next();
            }

            // 從緩存獲取用戶權限
            let permissions = cacheService.getUserPermissions(user.id);

            if (!permissions) {
                // 緩存未命中，從數據庫獲取
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

                permissions = {
                    group: groupResult.rows[0],
                    features: {}
                };

                // 將權限存入緩存
                cacheService.setUserPermissions(user.id, permissions);
            }

            // 檢查特定功能的權限
            if (permissions.group.permission_value === true) {
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

            // 如果是admin群組，直接允許訪問
            if (user.group_name === 'admin') {
                console.log('Access granted: Admin group');
                return next();
            }

            // 檢查用戶是否有權限訪問該商店
            if (!user.permitted_stores || !user.permitted_stores.includes(storeId)) {
                console.log('Store not in permitted stores list:', {
                    storeId,
                    permittedStores: user.permitted_stores
                });
                return res.status(403).json({
                    success: false,
                    error: 'Access denied: Store not in permitted stores list'
                });
            }

            // 從緩存獲取商店權限
            let storePermissions = cacheService.getStorePermissions(user.group_id, storeId);

            if (!storePermissions) {
                // 緩存未命中，從數據庫獲取
                const storePermissionResult = await pool.query(`
                    SELECT store_id, features
                    FROM group_store_permissions
                    WHERE group_id = $1 AND store_id = $2
                `, [user.group_id, storeId]);

                if (storePermissionResult.rows.length === 0) {
                    console.log('Store permissions not found');
                    return res.status(403).json({
                        success: false,
                        error: 'Access denied: Store permissions not found'
                    });
                }

                storePermissions = storePermissionResult.rows[0];
                
                // 將權限存入緩存
                cacheService.setStorePermissions(user.group_id, storeId, storePermissions);
            }

            // 如果是view或basic功能，允許所有有商店權限的用戶訪問
            if (feature === 'view' || !feature || feature === 'basic') {
                console.log('Access granted: Basic view permission');
                return next();
            }

            // 檢查特定功能的權限
            const features = storePermissions.features || {
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