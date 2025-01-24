import React, { createContext, useContext, useState, useCallback } from 'react';
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

    const getNotificationCount = useCallback((type, storeId) => {
        console.log('Getting notification count:', { 
            type, 
            storeId, 
            isAdmin: user?.group_name === 'admin',
            permissions,
            notifications: notifications[type]?.[storeId]
        });

        // If user is admin, show all notifications
        if (user?.group_name === 'admin') {
            const count = notifications[type]?.[storeId] || 0;
            console.log('Admin notification count:', count);
            return count;
        }

        // For regular users, check permissions
        const hasPermission = permissions?.store_permissions?.[storeId]?.[type] || 
                            permissions?.main_permissions?.[type];

        console.log('Permission check:', {
            storePermissions: permissions?.store_permissions?.[storeId],
            mainPermissions: permissions?.main_permissions,
            hasPermission
        });

        if (!hasPermission) {
            console.log('No permission for notifications');
            return 0;
        }

        const count = notifications[type]?.[storeId] || 0;
        console.log('User with permission notification count:', count);
        return count;
    }, [notifications, permissions, user?.group_name]);

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