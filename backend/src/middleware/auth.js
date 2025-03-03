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
                    WITH store_permissions AS (
                        SELECT 
                            gsp.group_id,
                            jsonb_object_agg(
                                gsp.store_id::text,
                                jsonb_build_object(
                                    'inventory', COALESCE((gsp.permissions->>'inventory')::boolean, false),
                                    'orders', COALESCE((gsp.permissions->>'orders')::boolean, false),
                                    'rma', COALESCE((gsp.permissions->>'rma')::boolean, false),
                                    'outbound', COALESCE((gsp.permissions->>'outbound')::boolean, false)
                                )
                            ) as store_permissions,
                            array_agg(DISTINCT gsp.store_id) as permitted_stores
                        FROM group_store_permissions gsp
                        GROUP BY gsp.group_id
                    )
                    SELECT 
                        u.id::integer,
                        u.username,
                        u.group_id::integer,
                        u.role_id::integer,
                        u.is_active,
                        g.name as group_name,
                        g.main_permissions,
                        r.name as role_name,
                        sp.permitted_stores,
                        sp.store_permissions
                    FROM users u
                    LEFT JOIN groups g ON u.group_id = g.id
                    LEFT JOIN roles r ON u.role_id = r.id
                    LEFT JOIN store_permissions sp ON g.id = sp.group_id
                    WHERE u.id = $1 AND u.is_active = true
                `, [userId]);

                if (result.rows.length === 0) {
                    throw new AuthenticationError('User not found or inactive');
                }

                userData = result.rows[0];
                
                // 確保數據類型正確
                userData.id = parseInt(userData.id, 10);
                userData.group_id = parseInt(userData.group_id, 10);
                userData.role_id = userData.role_id ? parseInt(userData.role_id, 10) : null;
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
                    
                    // 如果是 admin，確保所有商店都有完整權限
                    if (userData.permitted_stores && userData.permitted_stores.length > 0) {
                        const fullStorePermissions = {};
                        userData.permitted_stores.forEach(storeId => {
                            fullStorePermissions[storeId] = {
                                inventory: true,
                                orders: true,
                                rma: true,
                                outbound: true
                            };
                        });
                        userData.store_permissions = fullStorePermissions;
                    }
                } else {
                    // 確保 main_permissions 是一個對象
                    userData.main_permissions = userData.main_permissions || {};
                    // 確保 store_permissions 是一個對象
                    userData.store_permissions = userData.store_permissions || {};
                }

                console.log('User data loaded:', {
                    userId: userData.id,
                    username: userData.username,
                    group: userData.group_name,
                    mainPermissions: userData.main_permissions,
                    permittedStores: userData.permitted_stores,
                    storePermissions: userData.store_permissions
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
                        store_permissions: userData.store_permissions
                    };
                    cacheService.setUserPermissions(userId, permissionsData);
                    console.log('Cached permissions data:', permissionsData);
                }

                // 如果有商店權限，為每個商店設置權限緩存
                if (userData.permitted_stores && userData.store_permissions) {
                    userData.permitted_stores.forEach(storeId => {
                        if (userData.store_permissions[storeId]) {
                            const storePermissions = {
                                store_id: storeId,
                                permissions: userData.store_permissions[storeId]
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
                storeFeatures: req.user.store_permissions
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