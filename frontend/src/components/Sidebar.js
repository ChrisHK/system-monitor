import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layout, Menu, Modal, Form, Input, message, Badge } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import {
    ShopOutlined,
    SettingOutlined,
    LogoutOutlined,
    ImportOutlined,
    ExportOutlined,
    PlusOutlined,
    BranchesOutlined,
    DesktopOutlined,
    UnorderedListOutlined,
    ShoppingCartOutlined,
    RollbackOutlined,
    DatabaseOutlined
} from '@ant-design/icons';
import { storeService, userService } from '../api';
import './Sidebar.css';
import { Link } from 'react-router-dom';

const { Sider } = Layout;

const Sidebar = ({ collapsed, setCollapsed, storeId }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, user } = useAuth();
    const { getNotificationCount, clearNotification } = useNotification();
    const [stores, setStores] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [groupPermissions, setGroupPermissions] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [notificationCounts, setNotificationCounts] = useState({});
    const lastFetchRef = useRef(0);
    const FETCH_COOLDOWN = 5000; // 5 seconds cooldown

    // 緩存通知計數
    const cacheNotificationCount = useCallback((type, id, count) => {
        setNotificationCounts(prev => ({
            ...prev,
            [`${type}-${id}`]: count
        }));
    }, []);

    // 獲取緩存的通知計數
    const getCachedNotificationCount = useCallback((type, id) => {
        return notificationCounts[`${type}-${id}`] || 0;
    }, [notificationCounts]);

    // 檢查是否可以進行新的請求
    const canFetch = useCallback(() => {
        const now = Date.now();
        if (now - lastFetchRef.current >= FETCH_COOLDOWN) {
            lastFetchRef.current = now;
            return true;
        }
        return false;
    }, []);

    // 批量獲取通知計數
    const fetchNotificationCounts = useCallback(() => {
        if (!stores.length || !canFetch()) return;

        const types = ['inventory', 'order', 'rma'];
        const newCounts = {};

        // 主庫存和RMA的通知
        if (user?.group_name === 'admin' || groupPermissions?.main_permissions?.inventory) {
            const mainCount = getNotificationCount('inventory', 'main') || 0;
            const rmaCount = getNotificationCount('inventory', 'rma') || 0;
            newCounts['inventory-main'] = mainCount;
            newCounts['inventory-rma'] = rmaCount;
        }

        // 各商店的通知
        stores.forEach(store => {
            types.forEach(type => {
                const hasPermission = user?.group_name === 'admin' || 
                    groupPermissions?.store_permissions?.[store.id]?.[type];
                
                if (hasPermission) {
                    const count = getNotificationCount(type, store.id) || 0;
                    newCounts[`${type}-${store.id}`] = count;
                }
            });
        });

        setNotificationCounts(newCounts);
    }, [stores, user?.group_name, groupPermissions, getNotificationCount, canFetch]);

    // 獲取權限通知計數
    const getPermittedNotificationCount = useCallback((type, storeId, hasPermission) => {
        if (user?.group_name === 'admin' || hasPermission) {
            return getCachedNotificationCount(type, storeId);
        }
        return 0;
    }, [user?.group_name, getCachedNotificationCount]);

    const fetchUserDataAndStores = useCallback(async () => {
        if (!user?.id || isLoading) return;
        
        setIsLoading(true);
        try {
            // 1. 獲取用戶詳細信息
            const userResponse = await userService.getCurrentUser();
            if (!userResponse?.success) {
                throw new Error('Failed to fetch user details');
            }
            const userData = userResponse.user;

            // 2. 獲取群組信息
            const groupsResponse = await userService.getGroups();
            if (!groupsResponse?.success) {
                throw new Error('Failed to fetch groups');
            }

            // 3. 設置權限
            let userGroupPermissions = null;
            if (userData.role === 'admin' || userData.group_name === 'admin') {
                const adminGroup = groupsResponse.groups.find(g => g.name === 'admin');
                if (adminGroup) {
                    userGroupPermissions = {
                        success: true,
                        permissions: adminGroup.permitted_stores || [],
                        store_permissions: adminGroup.store_permissions || {},
                        main_permissions: {
                            inventory: true,
                            inventory_ram: true,
                            outbound: true,
                            inbound: true
                        }
                    };
                }
            } else if (userData.group_id) {
                const userGroup = groupsResponse.groups.find(g => g.id === userData.group_id);
                if (userGroup) {
                    // 確保 store_permissions 的格式正確
                    const processedStorePermissions = {};
                    Object.entries(userGroup.store_permissions || {}).forEach(([storeId, permissions]) => {
                        // 確保 storeId 是數字
                        const numericStoreId = parseInt(storeId, 10);
                        if (!isNaN(numericStoreId)) {
                            processedStorePermissions[numericStoreId] = {
                                inventory: permissions.inventory === true || permissions.inventory === '1',
                                orders: permissions.orders === true || permissions.orders === '1',
                                rma: permissions.rma === true || permissions.rma === '1',
                                outbound: permissions.outbound === true || permissions.outbound === '1'
                            };
                        }
                    });

                    userGroupPermissions = {
                        success: true,
                        permissions: userGroup.permitted_stores || [],
                        store_permissions: processedStorePermissions,
                        main_permissions: {
                            inventory: userGroup.main_permissions?.inventory === true || userGroup.main_permissions?.inventory === '1',
                            inventory_ram: userGroup.main_permissions?.inventory_ram === true || userGroup.main_permissions?.inventory_ram === '1',
                            outbound: userGroup.main_permissions?.outbound === true || userGroup.main_permissions?.outbound === '1',
                            inbound: userGroup.main_permissions?.inbound === true || userGroup.main_permissions?.inbound === '1'
                        }
                    };
                }
            }
            setGroupPermissions(userGroupPermissions);

            // 4. 獲取商店列表
            const storesResponse = await storeService.getStores();
            if (!storesResponse?.success) {
                throw new Error('Failed to fetch stores');
            }

            // 5. 根據權限過濾商店
            let filteredStores = storesResponse.stores;
            if (userData.role !== 'admin' && userGroupPermissions?.permissions) {
                // 使用 store_permissions 來過濾商店
                const permittedStoreIds = Object.keys(userGroupPermissions.store_permissions).map(id => parseInt(id, 10));
                filteredStores = storesResponse.stores.filter(store => 
                    permittedStoreIds.includes(store.id)
                );
            }
            setStores(filteredStores);

            // 獲取完商店列表後，更新通知計數
            fetchNotificationCounts();
        } catch (error) {
            console.error('Error fetching user data and stores:', error);
            message.error('Failed to load sidebar data');
        } finally {
            setIsLoading(false);
        }
    }, [user?.id, isLoading, fetchNotificationCounts]);

    // 初始化權限
    useEffect(() => {
        if (user?.id && !groupPermissions) {
            fetchUserDataAndStores();
        }
    }, [user?.id, groupPermissions, fetchUserDataAndStores]);

    // 定期更新通知計數
    useEffect(() => {
        if (!user?.id) return;

        // 初始加載
        fetchNotificationCounts();

        // 每30秒更新一次通知計數
        const intervalId = setInterval(fetchNotificationCounts, 30000);

        return () => clearInterval(intervalId);
    }, [user?.id, fetchNotificationCounts]);

    const handleLogout = useCallback(() => {
        logout();
        navigate('/login');
    }, [logout, navigate]);

    const handleAddStore = async (values) => {
        try {
            const response = await storeService.createStore(values);
            if (response?.success) {
                message.success('Store added successfully');
                form.resetFields();
                setIsModalVisible(false);
                fetchUserDataAndStores();
            }
        } catch (error) {
            console.error('Error adding store:', error);
            message.error('Failed to add store');
        }
    };

    const getSelectedKey = () => {
        const path = location.pathname;
        if (path === '/') return '/inventory';
        if (path.startsWith('/stores/')) {
            // Return the exact path for store routes (including sales and rma)
            return path;
        }
        return path;
    };

    // Add new function to handle notification clearing
    const handleNavigateAndClearNotification = (path, type, id) => {
        // Clear notification before navigation
        if (type && id) {
            clearNotification(type, id);
        }
        navigate(path);
    };

    const getMenuItems = useCallback(() => {
        const menuItems = [];

        // Check if user has any inventory-related permissions
        const hasInventoryPermission = user?.group_name === 'admin' || 
            groupPermissions?.main_permissions?.inventory === true;
        const hasInventoryRamPermission = user?.group_name === 'admin' || 
            groupPermissions?.main_permissions?.inventory_ram === true;
        const hasInboundPermission = user?.group_name === 'admin' || 
            groupPermissions?.main_permissions?.inbound === true;
        const hasPurchaseOrderPermission = user?.group_name === 'admin' || 
            groupPermissions?.main_permissions?.purchase_order === true;

        // Add Inventory menu item only if user has any inventory permissions
        if (hasInventoryPermission || hasInventoryRamPermission) {
            const inventoryChildren = [];

            // Add Inbound submenu if user has inbound permission
            if (hasInboundPermission) {
                const inboundChildren = [];
                
                // Add Purchase Order submenu if user has permission
                if (hasPurchaseOrderPermission) {
                    inboundChildren.push({
                        key: '/inbound/purchase-order',
                        icon: <ShoppingCartOutlined />,
                        label: 'Purchase Order',
                        onClick: () => navigate('/inbound/purchase-order')
                    });
                }

                if (inboundChildren.length > 0) {
                    menuItems.push({
                        key: 'inbound',
                        icon: <ImportOutlined />,
                        label: 'Inbound',
                        children: inboundChildren
                    });
                }
            }

            // Add Items submenu if user has inventory permission
            if (hasInventoryPermission) {
                const notificationCount = getCachedNotificationCount('inventory', 'main');
                inventoryChildren.push({
                    key: '/inventory',
                    icon: <UnorderedListOutlined />,
                    label: (
                        <Badge count={notificationCount} offset={[10, 0]}>
                            <span>Items</span>
                        </Badge>
                    ),
                    onClick: () => handleNavigateAndClearNotification('/inventory', 'inventory', 'main')
                });
            }

            // Add RMA submenu if user has inventory_ram permission
            if (hasInventoryRamPermission) {
                const notificationCount = getCachedNotificationCount('inventory', 'rma');
                inventoryChildren.push({
                    key: '/inventory/rma',
                    icon: <RollbackOutlined />,
                    label: (
                        <Badge count={notificationCount} offset={[10, 0]}>
                            <span>RMA</span>
                        </Badge>
                    ),
                    onClick: () => handleNavigateAndClearNotification('/inventory/rma', 'inventory', 'rma')
                });
            }

            // Only add the Inventory menu if there are accessible children
            if (inventoryChildren.length > 0) {
                menuItems.push({
                    key: 'inventory',
                    icon: <DatabaseOutlined />,
                    label: 'Inventory',
                    children: inventoryChildren
                });
            }
        }

        // Check if user has store permissions
        const hasStorePermissions = user?.group_name === 'admin' || 
            (groupPermissions?.store_permissions && 
             Object.values(groupPermissions.store_permissions).some(perm => 
                perm.inventory === true || perm.orders === true || perm.rma === true || perm.outbound === true
             ));

        // Show Branches menu if user has permissions
        if (hasStorePermissions) {
            const branchesItem = {
                key: 'branches',
                icon: <BranchesOutlined />,
                label: 'Branches',
                children: []
            };

            if (user?.group_name === 'admin') {
                branchesItem.children.push({
                    key: 'add-store',
                    icon: <PlusOutlined />,
                    label: 'Add Store'
                });
            }

            const storeItems = stores.map(store => {
                const storePermissions = groupPermissions?.store_permissions?.[store.id] || {};
                const menuItems = [];

                // Add menu items based on permissions
                if (user?.group_name === 'admin' || storePermissions.inventory === true) {
                    const notificationCount = getCachedNotificationCount('inventory', store.id);
                    menuItems.push({
                        key: `/stores/${store.id}`,
                        label: (
                            <Badge count={notificationCount} offset={[10, 0]}>
                                <span>Inventory</span>
                            </Badge>
                        ),
                        icon: <UnorderedListOutlined />,
                        onClick: () => handleNavigateAndClearNotification(`/stores/${store.id}`, 'inventory', store.id)
                    });
                }

                if (user?.group_name === 'admin' || storePermissions.orders === true) {
                    const notificationCount = getCachedNotificationCount('order', store.id);
                    menuItems.push({
                        key: `/stores/${store.id}/orders`,
                        label: (
                            <Badge count={notificationCount} offset={[10, 0]}>
                                <span>Orders</span>
                            </Badge>
                        ),
                        icon: <ShoppingCartOutlined />,
                        onClick: () => handleNavigateAndClearNotification(`/stores/${store.id}/orders`, 'order', store.id)
                    });
                }

                if (user?.group_name === 'admin' || storePermissions.rma === true) {
                    const notificationCount = getCachedNotificationCount('rma', store.id);
                    menuItems.push({
                        key: `/stores/${store.id}/rma`,
                        label: (
                            <Badge count={notificationCount} offset={[10, 0]}>
                                <span>RMA</span>
                            </Badge>
                        ),
                        icon: <RollbackOutlined />,
                        onClick: () => handleNavigateAndClearNotification(`/stores/${store.id}/rma`, 'rma', store.id)
                    });
                }

                // Store submenu with total notifications from all types
                if (menuItems.length > 0) {
                    // Calculate total notifications based on permissions
                    let totalNotifications = 0;
                    
                    // Only count notifications for sections the user has permission to see
                    if (user?.group_name === 'admin' || storePermissions.inventory === true) {
                        const inventoryCount = getCachedNotificationCount('inventory', store.id);
                        totalNotifications += inventoryCount || 0;
                    }
                    
                    if (user?.group_name === 'admin' || storePermissions.orders === true) {
                        const orderCount = getCachedNotificationCount('order', store.id);
                        totalNotifications += orderCount || 0;
                    }
                    
                    if (user?.group_name === 'admin' || storePermissions.rma === true) {
                        const rmaCount = getCachedNotificationCount('rma', store.id);
                        totalNotifications += rmaCount || 0;
                    }

                    return {
                        key: `store-${store.id}`,
                        label: totalNotifications > 0 ? (
                            <Badge count={totalNotifications} offset={[10, 0]}>
                                <span>{store.name}</span>
                            </Badge>
                        ) : <span>{store.name}</span>,
                        icon: <ShopOutlined />,
                        children: menuItems
                    };
                }
                return null;
            }).filter(Boolean);

            if (storeItems.length > 0) {
                branchesItem.children.push(...storeItems);
                menuItems.push(branchesItem);
            }
        }

        // Add settings only for admin group
        if (user?.group_name === 'admin') {
            menuItems.push({
                key: '/settings',
                icon: <SettingOutlined />,
                label: 'Settings',
                onClick: () => navigate('/settings')
            });
        }

        // Always add logout
        menuItems.push({
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Logout',
            onClick: handleLogout
        });

        return menuItems;
    }, [user?.group_name, groupPermissions, stores, getCachedNotificationCount, navigate, handleLogout, handleNavigateAndClearNotification]);

    const handleMenuClick = (e) => {
        if (e.key === 'logout') {
            handleLogout();
        } else if (e.key === 'add-store') {
            setIsModalVisible(true);
        } else if (e.key.startsWith('/stores/')) {
            return;
        } else {
            navigate(e.key);
        }
    };

    const getMenuItem = (label, key, icon, children) => {
        const notificationCount = getCachedNotificationCount(
            key === 'inventory' ? 'inventory' : 'store',
            storeId
        );

        return {
            key,
            icon,
            children,
            label: (
                <Badge count={notificationCount} offset={[10, 0]}>
                    <span>{label}</span>
                </Badge>
            )
        };
    };

    const items = [
        getMenuItem('Dashboard', 'dashboard'),
        getMenuItem('Orders', 'orders'),
        getMenuItem('RMA', 'rma'),
        getMenuItem('Inventory', 'inventory'),
        getMenuItem('Outbound', 'outbound'),
    ];

    return (
        <>
            <Sider 
                collapsible 
                collapsed={collapsed} 
                onCollapse={setCollapsed}
                breakpoint="lg"
                collapsedWidth="80"
                theme="light"
            >
                <div className="sidebar-logo" />
                <Menu
                    theme="light"
                    mode="inline"
                    selectedKeys={[getSelectedKey()]}
                    defaultOpenKeys={['branches']}
                    items={getMenuItems()}
                    onClick={handleMenuClick}
                />
            </Sider>

            <Modal
                title="Add New Store"
                open={isModalVisible}
                onOk={() => form.submit()}
                onCancel={() => {
                    setIsModalVisible(false);
                    form.resetFields();
                }}
                className="store-modal"
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleAddStore}
                >
                    <Form.Item
                        name="name"
                        label="Store Name"
                        rules={[{ required: true, message: 'Please input store name!' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="address"
                        label="Address"
                        rules={[{ required: true, message: 'Please input store address!' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="phone"
                        label="Phone"
                        rules={[{ required: true, message: 'Please input store phone!' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="email"
                        label="Email"
                        rules={[
                            { required: true, message: 'Please input store email!' },
                            { type: 'email', message: 'Please input a valid email!' }
                        ]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="description"
                        label="Description"
                    >
                        <Input.TextArea rows={4} />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default Sidebar; 