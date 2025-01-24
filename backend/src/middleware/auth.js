const jwt = require('jsonwebtoken');
const pool = require('../db');
const cacheService = require('../services/cacheService');

const auth = async (req, res, next) => {
    console.log('=== Starting Authentication ===');
    
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            throw new Error('No token provided');
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.id;
            
            console.log('Token verified for user:', userId);
            
            // 嘗試從緩存獲取用戶數據
            const cacheKey = cacheService.generateAuthKey(userId);
            let userData = cacheService.get(cacheKey);

            console.log('Cache check result:', {
                userId,
                hasCachedData: !!userData
            });

            if (!userData) {
                console.log('Cache miss - Fetching user data from database');
                // 緩存未命中，從數據庫獲取用戶數據和權限
                const result = await pool.query(`
                    WITH user_data AS (
                        SELECT 
                            u.id,
                            u.username,
                            u.group_id as user_group_id,
                            u.role_id,
                            u.is_active,
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
                        GROUP BY u.id, u.username, u.group_id, u.role_id, u.is_active, g.id, g.name, r.name
                    ),
                    permissions_data AS (
                        SELECT 
                            gp.permission_type,
                            gp.permission_value
                        FROM user_data ud
                        LEFT JOIN group_permissions gp ON ud.group_id = gp.group_id
                    )
                    SELECT 
                        ud.id,
                        ud.username,
                        ud.user_group_id as group_id,
                        ud.role_id,
                        ud.is_active,
                        ud.group_name,
                        ud.role_name,
                        ud.permitted_stores,
                        ud.store_features,
                        json_agg(pd.*) FILTER (WHERE pd.permission_type IS NOT NULL) as permissions
                    FROM user_data ud
                    LEFT JOIN permissions_data pd ON true
                    GROUP BY ud.id, ud.username, ud.user_group_id, ud.role_id, ud.is_active,
                            ud.group_name, ud.role_name, ud.permitted_stores, ud.store_features
                `, [userId]);

                if (result.rows.length === 0) {
                    throw new Error('User not found or inactive');
                }

                userData = result.rows[0];
                console.log('Database query result:', {
                    userId: userData.id,
                    username: userData.username,
                    group: userData.group_name,
                    role: userData.role_name,
                    hasPermissions: !!userData.permissions,
                    permittedStores: userData.permitted_stores
                });
                
                // 將用戶數據存入緩存
                cacheService.set(cacheKey, userData);

                // 將權限數據存入緩存
                if (userData.permissions) {
                    const permissionsData = {
                        group: {
                            group_name: userData.group_name,
                            permissions: userData.permissions.filter(p => p !== null)
                        },
                        features: userData.store_features
                    };
                    cacheService.setUserPermissions(userId, permissionsData);
                    console.log('Cached permissions data:', permissionsData);
                }

                // 如果有商店權限，為每個商店設置權限緩存
                if (userData.permitted_stores && userData.store_features) {
                    userData.permitted_stores.forEach((storeId, index) => {
                        if (userData.store_features[index]) {
                            const storePermissions = {
                                store_id: storeId,
                                features: userData.store_features[index]
                            };
                            cacheService.setStorePermissions(
                                userData.group_id,
                                storeId,
                                storePermissions
                            );
                            console.log('Cached store permissions:', {
                                storeId,
                                groupId: userData.group_id,
                                permissions: storePermissions
                            });
                        }
                    });
                }
            }

            req.user = userData;
            console.log('Authentication successful for user:', {
                id: req.user.id,
                group: req.user.group_name,
                role: req.user.role_name,
                fromCache: !!userData,
                permissions: req.user.permissions,
                storeFeatures: req.user.store_features
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

// 清除用戶緩存的輔助函數
const clearUserCache = (userId) => {
    // 清除用戶認證緩存
    const authKey = cacheService.generateAuthKey(userId);
    cacheService.del(authKey);

    // 清除用戶權限緩存
    cacheService.clearUserPermissions(userId);
    console.log('Cleared cache for user:', userId);
};

const checkGroup = (requiredGroups = [], requireStore = false) => {
    return (req, res, next) => {
        const { user } = req;
        
        console.log('=== Checking Group Permissions ===', {
            user: {
                id: user?.id,
                group: user?.group_name,
                hasGroupId: !!user?.group_id
            },
            required: {
                groups: requiredGroups,
                requireStore
            }
        });
        
        if (!user?.group_id) {
            console.log('Access denied: No group assigned');
            return res.status(403).json({
                success: false,
                error: 'Access denied: No group assigned'
            });
        }

        const isAdminGroup = user.group_name === 'admin';
        const hasGroupPermission = isAdminGroup || requiredGroups.includes(user.group_name);
        const hasStorePermission = !requireStore || 
            isAdminGroup || 
            (user.permitted_stores && user.permitted_stores.length > 0);

        console.log('Permission check result:', {
            isAdminGroup,
            hasGroupPermission,
            hasStorePermission,
            permittedStores: user.permitted_stores
        });

        if (!hasGroupPermission) {
            console.log('Access denied: Insufficient group permissions');
            return res.status(403).json({
                success: false,
                error: 'Access denied: Insufficient group permissions'
            });
        }

        if (requireStore && !hasStorePermission) {
            console.log('Access denied: No store permissions');
            return res.status(403).json({
                success: false,
                error: 'Access denied: No store permissions'
            });
        }

        console.log('Permission check passed');
        next();
    };
};

module.exports = { auth, checkGroup, clearUserCache }; 