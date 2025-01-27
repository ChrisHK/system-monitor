const permissionCache = new Map();
const PERMISSION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const checkPermission = (type) => async (req, res, next) => {
    const userId = req.user.id;
    const storeId = req.params.storeId;
    const cacheKey = `${userId}-${type}-${storeId}`;

    // 檢查緩存
    const cachedPermission = permissionCache.get(cacheKey);
    if (cachedPermission && cachedPermission.expiry > Date.now()) {
        if (cachedPermission.hasPermission) {
            return next();
        }
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        // 管理員直接通過
        if (req.user.group_name === 'admin') {
            permissionCache.set(cacheKey, {
                hasPermission: true,
                expiry: Date.now() + PERMISSION_CACHE_TTL
            });
            return next();
        }

        // 檢查商店權限
        const hasPermission = req.user.store_permissions?.[storeId]?.[type] === true;
        
        // 設置緩存
        permissionCache.set(cacheKey, {
            hasPermission,
            expiry: Date.now() + PERMISSION_CACHE_TTL
        });

        if (hasPermission) {
            return next();
        }

        res.status(403).json({ error: 'Permission denied' });
    } catch (error) {
        console.error(`Permission check error (${type}):`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
}; 