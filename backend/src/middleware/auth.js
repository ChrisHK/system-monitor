const jwt = require('jsonwebtoken');
const pool = require('../db');
const cacheService = require('../services/cacheService');
const { AuthenticationError } = require('./errorTypes');

const authCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const auth = async (req, res, next) => {
    console.log('=== Starting Authentication ===');
    
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            throw new AuthenticationError('No token provided');
        }

        // 檢查緩存
        const cachedAuth = authCache.get(token);
        if (cachedAuth && cachedAuth.expiry > Date.now()) {
            req.user = cachedAuth.user;
            return next();
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET, {
                algorithms: [process.env.JWT_ALGORITHM || 'HS256']
            });
            
            // 確保 id 是數字類型
            const userId = typeof decoded.id === 'string' ? parseInt(decoded.id, 10) : decoded.id;
            if (isNaN(userId)) {
                throw new AuthenticationError('Invalid user ID in token');
            }
            
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
                            u.id::integer,
                            u.username,
                            u.group_id::integer as user_group_id,
                            u.role_id::integer,
                            u.is_active,
                            g.name as group_name,
                            g.permissions,
                            g.id::integer as group_id,
                            r.name as role_name,
                            ARRAY_AGG(DISTINCT gsp.store_id::integer) FILTER (WHERE gsp.store_id IS NOT NULL) as permitted_stores,
                            ARRAY_AGG(DISTINCT gsp.features) FILTER (WHERE gsp.features IS NOT NULL) as store_features,
                            jsonb_build_object(
                                'inventory', CASE WHEN gp_inv.permission_value IS NULL THEN false 
                                                WHEN gp_inv.permission_value::text = 'true' THEN true 
                                                ELSE false END,
                                'inventory_ram', CASE WHEN gp_ram.permission_value IS NULL THEN false 
                                                    WHEN gp_ram.permission_value::text = 'true' THEN true 
                                                    ELSE false END,
                                'inbound', CASE WHEN gp_in.permission_value IS NULL THEN false 
                                              WHEN gp_in.permission_value::text = 'true' THEN true 
                                              ELSE false END,
                                'outbound', CASE WHEN gp_out.permission_value IS NULL THEN false 
                                               WHEN gp_out.permission_value::text = 'true' THEN true 
                                               ELSE false END,
                                'purchase_order', CASE WHEN gp_po.permission_value IS NULL THEN false 
                                                     WHEN gp_po.permission_value::text = 'true' THEN true 
                                                     ELSE false END,
                                'tag_management', CASE WHEN gp_tag.permission_value IS NULL THEN false 
                                                     WHEN gp_tag.permission_value::text = 'true' THEN true 
                                                     ELSE false END
                            ) as main_permissions
                        FROM users u
                        LEFT JOIN groups g ON u.group_id = g.id
                        LEFT JOIN roles r ON u.role_id = r.id
                        LEFT JOIN group_store_permissions gsp ON g.id = gsp.group_id
                        LEFT JOIN group_permissions gp_inv ON g.id = gp_inv.group_id AND gp_inv.permission_type = 'inventory'
                        LEFT JOIN group_permissions gp_ram ON g.id = gp_ram.group_id AND gp_ram.permission_type = 'inventory_ram'
                        LEFT JOIN group_permissions gp_in ON g.id = gp_in.group_id AND gp_in.permission_type = 'inbound'
                        LEFT JOIN group_permissions gp_out ON g.id = gp_out.group_id AND gp_out.permission_type = 'outbound'
                        LEFT JOIN group_permissions gp_po ON g.id = gp_po.group_id AND gp_po.permission_type = 'purchase_order'
                        LEFT JOIN group_permissions gp_tag ON g.id = gp_tag.group_id AND gp_tag.permission_type = 'tag_management'
                        WHERE u.id = $1 AND u.is_active = true
                        GROUP BY 
                            u.id, u.username, u.group_id, u.role_id, u.is_active, 
                            g.id, g.name, g.permissions, r.name,
                            gp_inv.permission_value, gp_ram.permission_value, 
                            gp_in.permission_value, gp_out.permission_value,
                            gp_po.permission_value, gp_tag.permission_value
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
                    throw new AuthenticationError('User not found or inactive');
                }

                userData = result.rows[0];
                
                // 確保數據類型正確
                userData.id = parseInt(userData.id, 10);
                userData.group_id = parseInt(userData.group_id, 10);
                userData.role_id = parseInt(userData.role_id, 10);
                userData.permitted_stores = userData.permitted_stores?.map(id => parseInt(id, 10)) || [];

                // 確保 admin 用戶有所有權限
                if (userData.group_name === 'admin') {
                    userData.main_permissions = {
                        inventory: true,
                        inventory_ram: true,
                        inbound: true,
                        outbound: true,
                        purchase_order: true,
                        tag_management: true
                    };
                }

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
            console.error('JWT verification failed:', {
                error: jwtError.message,
                name: jwtError.name,
                stack: jwtError.stack
            });
            
            if (jwtError.name === 'TokenExpiredError') {
                throw new AuthenticationError('Token has expired');
            } else if (jwtError.name === 'JsonWebTokenError') {
                throw new AuthenticationError('Invalid token');
            }
            throw new AuthenticationError('Token verification failed');
        }
    } catch (error) {
        console.error('=== Authentication Error ===', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        const statusCode = error instanceof AuthenticationError ? 401 : 500;
        const errorMessage = error instanceof AuthenticationError 
            ? error.message 
            : 'Internal server error during authentication';
        
        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            code: error.name
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
                permissions: user?.permissions,
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

        const isAdminGroup = user.group_name === 'admin' || (user.permissions && user.permissions.includes('admin'));
        const hasGroupPermission = isAdminGroup || requiredGroups.includes(user.group_name);
        const hasStorePermission = !requireStore || 
            isAdminGroup || 
            (user.permitted_stores && user.permitted_stores.length > 0);

        console.log('Permission check result:', {
            isAdminGroup,
            hasGroupPermission,
            hasStorePermission,
            permissions: user.permissions,
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