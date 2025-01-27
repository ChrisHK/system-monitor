import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { message } from 'antd';

const NotificationContext = createContext();

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState({
        inventory: {},  // { storeId: count }
        order: {},     // { storeId: count }
        rma: {}        // { storeId: count }
    });
    const [permissions, setPermissions] = useState(null);

    // 使用 useMemo 緩存權限檢查結果
    const permissionChecks = useMemo(() => {
        const checks = {};
        if (!user) return checks;

        // 預先計算所有商店的權限
        const stores = user.permitted_stores || [];
        stores.forEach(storeId => {
            const storePermissions = user.store_permissions?.[storeId];
            checks[storeId] = {
                inventory: storePermissions?.inventory || false,
                rma: storePermissions?.rma || false,
                orders: storePermissions?.orders || false,
                outbound: storePermissions?.outbound || false
            };
        });

        // 添加主要權限
        checks.main = user.main_permissions || {};
        
        return checks;
    }, [user]);

    // 優化後的權限檢查函數
    const checkPermission = useCallback((type, storeId) => {
        if (user?.group_name === 'admin') return true;
        
        // 使用緩存的權限檢查結果
        const permissions = permissionChecks[storeId];
        if (!permissions) return false;

        switch (type) {
            case 'inventory':
                return permissions.inventory;
            case 'rma':
                return permissions.rma;
            case 'orders':
                return permissions.orders;
            case 'outbound':
                return permissions.outbound;
            default:
                return false;
        }
    }, [user, permissionChecks]);

    // 優化獲取通知數量的函數
    const getNotificationCount = useCallback((type, storeId) => {
        // 首先檢查權限
        if (!checkPermission(type, storeId)) {
            return 0;
        }

        // 如果有權限，再獲取通知數量
        return notifications[`${type}_${storeId}`] || 0;
    }, [notifications, checkPermission]);

    const showToast = useCallback((type, storeId) => {
        const typeMap = {
            inventory: 'Inventory',
            order: 'Orders',
            rma: 'RMA'
        };
        
        message.info({
            content: `New ${typeMap[type]} update for store ${storeId}`,
            duration: 5,
            key: `${type}-${storeId}`  // Prevent duplicate messages
        });
    }, []);

    const addNotification = useCallback((type, storeId) => {
        console.log('Adding notification:', { type, storeId });
        setNotifications(prev => {
            const newNotifications = { ...prev };
            if (!newNotifications[type]) {
                newNotifications[type] = {};
            }
            newNotifications[type][storeId] = (newNotifications[type][storeId] || 0) + 1;
            console.log('Updated notifications:', newNotifications);
            
            // Show toast notification
            showToast(type, storeId);
            
            return newNotifications;
        });
    }, [showToast]);

    const clearNotification = useCallback((type, storeId) => {
        console.log('Clearing notification:', { type, storeId });
        setNotifications(prev => {
            const newNotifications = { ...prev };
            if (newNotifications[type]) {
                delete newNotifications[type][storeId];
            }
            console.log('Updated notifications after clear:', newNotifications);
            return newNotifications;
        });
    }, []);

    const setUserPermissions = useCallback((newPermissions) => {
        console.log('Setting user permissions:', newPermissions);
        setPermissions(newPermissions);
    }, []);

    return (
        <NotificationContext.Provider 
            value={{ 
                addNotification, 
                clearNotification, 
                getNotificationCount,
                setUserPermissions,
                notifications // Export notifications state for debugging
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
};

export default NotificationContext; 