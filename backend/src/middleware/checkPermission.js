const pool = require('../db');
const cacheService = require('../services/cacheService');

// 檢查主要權限
const checkMainPermission = (feature) => {
    return async (req, res, next) => {
        try {
            const { user } = req;

            console.log('=== Checking Main Permission ===', {
                userId: user.id,
                username: user.username,
                group: user.group_name,
                feature,
                mainPermissions: user.main_permissions
            });

            // 如果是admin群組，直接允許訪問
            if (user.group_name === 'admin') {
                console.log('Access granted: Admin group');
                return next();
            }

            // 檢查 main_permissions
            if (user.main_permissions && 
                (user.main_permissions[feature] === true || 
                 (feature === 'bulk_select' && user.main_permissions.bulk_select === true))) {
                console.log(`Access granted: Has ${feature} permission`);
                return next();
            }

            console.log(`Access denied: No ${feature} permission`, {
                userPermissions: user.main_permissions
            });

            return res.status(403).json({
                success: false,
                error: `Access denied: No permission for ${feature}`
            });
        } catch (error) {
            console.error('Error checking main permission:', {
                error: error.message,
                stack: error.stack,
                feature
            });
            
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
                    SELECT permissions, bulk_select
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
            const permissions = storePermissions.permissions || {
                view: true,
                basic: true,
                inventory: false,
                orders: false,
                rma: false
            };

            // 檢查批量選擇權限
            if (feature === 'bulk_select') {
                if (storePermissions.bulk_select === true) {
                    console.log('Access granted: Has bulk select permission');
                    return next();
                }
                console.log('Access denied: No bulk select permission');
                return res.status(403).json({
                    success: false,
                    error: 'Access denied: No bulk select permission for this store'
                });
            }

            console.log('Current permissions:', permissions);
            if (permissions[feature] === true) {
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

// 檢查批量選擇權限
const checkBulkSelectPermission = () => {
    return async (req, res, next) => {
        try {
            const { user } = req;
            const storeId = parseInt(req.params.storeId || req.query.storeId || req.body.storeId);

            // 如果是admin群組，直接允許訪問
            if (user.group_name === 'admin') {
                return next();
            }

            // 檢查主要權限
            if (user.main_permissions && user.main_permissions.bulk_select === true) {
                return next();
            }

            // 檢查商店特定的批量選擇權限
            if (storeId) {
                const result = await pool.query(`
                    SELECT bulk_select
                    FROM group_store_permissions
                    WHERE group_id = $1 AND store_id = $2
                `, [user.group_id, storeId]);

                if (result.rows.length > 0 && result.rows[0].bulk_select === true) {
                    return next();
                }
            }

            return res.status(403).json({
                success: false,
                error: 'Access denied: No bulk select permission'
            });
        } catch (error) {
            console.error('Error checking bulk select permission:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error while checking permissions'
            });
        }
    };
};

module.exports = {
    checkStorePermission,
    checkMainPermission,
    checkBulkSelectPermission
}; 