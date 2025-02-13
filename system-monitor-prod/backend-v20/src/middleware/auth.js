const jwt = require('jsonwebtoken');
const pool = require('../db');
const cacheService = require('../services/cacheService');

const authCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const auth = async (req, res, next) => {
    console.log('=== Starting Authentication ===');
    
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            throw new Error('No token provided');
        }

        // 檢查緩存
        const cachedAuth = authCache.get(token);
        if (cachedAuth && cachedAuth.expiry > Date.now()) {
            req.user = cachedAuth.user;
            return next();
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
                            ARRAY_AGG(DISTINCT gsp.features) FILTER (WHERE gsp.features IS NOT NULL) as store_features,
                            jsonb_build_object(
                                'inventory', BOOL_OR(CASE WHEN gp.permission_type = 'inventory' THEN gp.permission_value::boolean ELSE false END),
                                'inventory_ram', BOOL_OR(CASE WHEN gp.permission_type = 'inventory_ram' THEN gp.permission_value::boolean ELSE false END),
                                'inbound', BOOL_OR(CASE WHEN gp.permission_type = 'inbound' THEN gp.permission_value::boolean ELSE false END),
                                'outbound', BOOL_OR(CASE WHEN gp.permission_type = 'outbound' THEN gp.permission_value::boolean ELSE false END)
                            ) as main_permissions
                        FROM users u
                        LEFT JOIN groups g ON u.group_id = g.id
                        LEFT JOIN roles r ON u.role_id = r.id
                        LEFT JOIN group_store_permissions gsp ON g.id = gsp.group_id
                        LEFT JOIN group_permissions gp ON g.id = gp.group_id
                        WHERE u.id = $1 AND u.is_active = true
                        GROUP BY u.id, u.username, u.group_id, u.role_id, u.is_active, g.id, g.name, r.name
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
                        ud.main_permissions
                    FROM user_data ud
                `, [userId]);

                if (result.rows.length === 0) {
                    throw new Error('User not found or inactive');
                }

                userData = result.rows[0];
                console.log('User data loaded:', {
                    userId: userData.id,
                    username: userData.username,
                    group: userData.group_name,
                    mainPermissions: userData.main_permissions,
                    permittedStores: userData.permitted_stores
                });
                
                // 將用戶數據存入緩存
                cacheService.set(cacheKey, userData);

                // 將權限數據存入緩存
                if (userData.main_permissions) {
                    const permissionsData = {
                        group: {
                            group_name: userData.group_name,
                            permissions: userData.main_permissions
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

            // 設置緩存
            authCache.set(token, {
                user: userData,
                expiry: Date.now() + CACHE_TTL
            });

            req.user = userData;
            console.log('Authentication successful for user:', {
                id: req.user.id,
                group: req.user.group_name,
                role: req.user.role_name,
                fromCache: !!userData,
                mainPermissions: req.user.main_permissions,
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