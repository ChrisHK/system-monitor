const cache = require('../config/cache');

class CacheService {
    constructor() {
        this.defaultTTL = 900; // 15 minutes in seconds
        this.storeListTTL = 3600; // 1 hour for store list
        this.permissionsTTL = 1800; // 30 minutes for permissions
    }

    /**
     * 獲取緩存的值
     * @param {string} key - 緩存鍵
     * @returns {any} - 緩存的值
     */
    get(key) {
        try {
            return cache.get(key);
        } catch (err) {
            console.error('Cache get error:', err);
            return null;
        }
    }

    /**
     * 設置緩存
     * @param {string} key - 緩存鍵
     * @param {any} value - 要緩存的值
     * @param {number} ttl - 過期時間（秒）
     */
    set(key, value, ttl = this.defaultTTL) {
        try {
            return cache.set(key, value, ttl);
        } catch (err) {
            console.error('Cache set error:', err);
            return false;
        }
    }

    /**
     * 刪除緩存
     * @param {string} key - 緩存鍵
     */
    del(key) {
        try {
            return cache.del(key);
        } catch (err) {
            console.error('Cache delete error:', err);
            return false;
        }
    }

    /**
     * 清除所有緩存
     */
    clear() {
        try {
            return cache.flushAll();
        } catch (err) {
            console.error('Cache clear error:', err);
            return false;
        }
    }

    /**
     * 獲取緩存統計信息
     */
    getStats() {
        return cache.getStats();
    }

    /**
     * 生成用戶認證緩存鍵
     * @param {number} userId - 用戶ID
     * @returns {string} - 緩存鍵
     */
    generateAuthKey(userId) {
        return `auth:${userId}`;
    }

    /**
     * 生成商店列表緩存鍵
     * @param {string} groupName - 用戶組名稱
     * @returns {string} - 緩存鍵
     */
    generateStoreListKey(groupName = 'all') {
        return `stores:list:${groupName}`;
    }

    /**
     * 獲取商店列表緩存
     * @param {string} groupName - 用戶組名稱
     * @returns {Array} - 商店列表
     */
    getStoreList(groupName = 'all') {
        const key = this.generateStoreListKey(groupName);
        return this.get(key);
    }

    /**
     * 設置商店列表緩存
     * @param {Array} stores - 商店列表
     * @param {string} groupName - 用戶組名稱
     */
    setStoreList(stores, groupName = 'all') {
        const key = this.generateStoreListKey(groupName);
        return this.set(key, stores, this.storeListTTL);
    }

    /**
     * 清除商店列表緩存
     * @param {string} groupName - 用戶組名稱，如果不指定則清除所有商店列表緩存
     */
    clearStoreListCache(groupName = null) {
        if (groupName) {
            // 清除特定用戶組的商店列表緩存
            const key = this.generateStoreListKey(groupName);
            return this.del(key);
        } else {
            // 清除所有商店列表相關的緩存
            const keys = cache.keys();
            const storeKeys = keys.filter(key => key.startsWith('stores:list:'));
            storeKeys.forEach(key => this.del(key));
            return true;
        }
    }

    /**
     * 生成用戶權限緩存鍵
     * @param {number} userId - 用戶ID
     * @returns {string} - 緩存鍵
     */
    generatePermissionsKey(userId) {
        return `permissions:${userId}`;
    }

    /**
     * 獲取用戶權限緩存
     * @param {number} userId - 用戶ID
     * @returns {Object} - 用戶權限數據
     */
    getUserPermissions(userId) {
        const key = this.generatePermissionsKey(userId);
        return this.get(key);
    }

    /**
     * 設置用戶權限緩存
     * @param {number} userId - 用戶ID
     * @param {Object} permissions - 權限數據
     */
    setUserPermissions(userId, permissions) {
        const key = this.generatePermissionsKey(userId);
        return this.set(key, permissions, this.permissionsTTL);
    }

    /**
     * 清除用戶權限緩存
     * @param {number} userId - 用戶ID
     */
    clearUserPermissions(userId) {
        const key = this.generatePermissionsKey(userId);
        return this.del(key);
    }

    /**
     * 生成商店權限緩存鍵
     * @param {number} groupId - 用戶組ID
     * @param {number} storeId - 商店ID
     * @returns {string} - 緩存鍵
     */
    generateStorePermissionKey(groupId, storeId) {
        return `store:permissions:${groupId}:${storeId}`;
    }

    /**
     * 獲取商店權限緩存
     * @param {number} groupId - 用戶組ID
     * @param {number} storeId - 商店ID
     * @returns {Object} - 商店權限數據
     */
    getStorePermissions(groupId, storeId) {
        const key = this.generateStorePermissionKey(groupId, storeId);
        return this.get(key);
    }

    /**
     * 設置商店權限緩存
     * @param {number} groupId - 用戶組ID
     * @param {number} storeId - 商店ID
     * @param {Object} permissions - 權限數據
     */
    setStorePermissions(groupId, storeId, permissions) {
        const key = this.generateStorePermissionKey(groupId, storeId);
        return this.set(key, permissions, this.permissionsTTL);
    }

    /**
     * 清除商店權限緩存
     * @param {number} groupId - 用戶組ID
     * @param {number} storeId - 商店ID
     */
    clearStorePermissions(groupId, storeId) {
        const key = this.generateStorePermissionKey(groupId, storeId);
        return this.del(key);
    }

    /**
     * 清除所有權限相關緩存
     */
    clearAllPermissionsCache() {
        const keys = cache.keys();
        const permissionKeys = keys.filter(key => 
            key.startsWith('permissions:') || 
            key.startsWith('store:permissions:')
        );
        permissionKeys.forEach(key => this.del(key));
        return true;
    }
}

module.exports = new CacheService(); 