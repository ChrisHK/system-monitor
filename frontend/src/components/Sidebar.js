import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Layout, Menu, Modal, Form, Input, message } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    ShopOutlined,
    SettingOutlined,
    LogoutOutlined,
    ImportOutlined,
    ExportOutlined,
    DatabaseOutlined,
    PlusOutlined,
    BranchesOutlined,
    DesktopOutlined,
    UnorderedListOutlined,
    ShoppingCartOutlined,
    RollbackOutlined
} from '@ant-design/icons';
import { storeApi, groupApi } from '../services/api';
import api from '../services/api';
import './Sidebar.css';

const { Sider } = Layout;

const Sidebar = ({ collapsed, setCollapsed }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, user } = useAuth();
    const [stores, setStores] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const storesRef = useRef(null);
    const fetchingRef = useRef(false);
    const [groupPermissions, setGroupPermissions] = useState(null);

    // 獲取用戶組權限
    const fetchGroupPermissions = useCallback(async () => {
        if (!user?.id) return;
        
        try {
            console.log('Fetching user details for user_id:', user.id);
            const userResponse = await api.get('/users/me');
            console.log('User response:', userResponse);

            if (userResponse?.success) {
                const userData = userResponse.user;
                
                if (userData.role === 'admin') {
                    console.log('Admin user detected, fetching admin group');
                    const groupsResponse = await groupApi.getGroups();
                    console.log('Groups response:', groupsResponse);
                    
                    if (groupsResponse?.success) {
                        const adminGroup = groupsResponse.groups.find(g => g.name.toLowerCase() === 'admin');
                        if (adminGroup) {
                            console.log('Found admin group:', adminGroup);
                            setGroupPermissions({ success: true, permissions: adminGroup.permitted_stores });
                        }
                    }
                } else if (userData.group_id) {
                    console.log('Regular user, fetching group permissions for group_id:', userData.group_id);
                    const groupResponse = await groupApi.getGroups();
                    if (groupResponse?.success) {
                        const userGroup = groupResponse.groups.find(g => g.id === userData.group_id);
                        if (userGroup) {
                            console.log('Found user group:', userGroup);
                            setGroupPermissions({ 
                                success: true, 
                                permissions: userGroup.permitted_stores,
                                features: userGroup.features || [],
                                access_rights: userGroup.access_rights || []
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching group permissions:', error);
        }
    }, [user?.id]);

    const fetchStores = useCallback(async () => {
        if (fetchingRef.current) {
            return;
        }

        try {
            fetchingRef.current = true;
            console.log('Fetching stores for sidebar...');
            const response = await storeApi.getStores();
            console.log('Sidebar stores response:', response);

            if (response?.success) {
                let filteredStores = response.stores;
                
                // 檢查權限數據結構
                console.log('Current group permissions:', groupPermissions);
                
                // 如果是管理員或有商店權限
                if (user?.role === 'admin' || groupPermissions?.permissions) {
                    console.log('User has store permissions:', 
                        user?.role === 'admin' ? 'admin' : groupPermissions.permissions);
                    
                    if (user?.role === 'admin') {
                        // Admin can see all stores
                        filteredStores = response.stores;
                    } else {
                        // Regular users filter stores based on permissions
                        const permittedStores = groupPermissions.permissions;
                        console.log('Permitted stores:', permittedStores);
                        filteredStores = response.stores.filter(store => 
                            permittedStores.includes(store.id)
                        );
                    }
                    console.log('Filtered stores:', filteredStores);
                } else {
                    console.log('No store permissions found');
                    filteredStores = [];
                }
                
                setStores(filteredStores);
                storesRef.current = filteredStores;
            }
        } catch (error) {
            console.error('Error fetching stores:', error);
            message.error('Failed to load stores');
        } finally {
            fetchingRef.current = false;
        }
    }, [groupPermissions, user?.role]);

    // 當組權限更新時重新獲取商店列表
    useEffect(() => {
        if (groupPermissions) {
            fetchStores();
        }
    }, [groupPermissions, fetchStores]);

    // 初始化時獲取組權限
    useEffect(() => {
        if (user) {
            fetchGroupPermissions();
        }
    }, [user, fetchGroupPermissions]);

    const handleLogout = useCallback(() => {
        console.log('Logging out...');
        logout();
        navigate('/login');
    }, [logout, navigate]);

    const handleAddStore = async (values) => {
        try {
            const response = await storeApi.addStore(values);
            if (response?.success) {
                message.success('Store added successfully');
                form.resetFields();
                setIsModalVisible(false);
                fetchStores();
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

    const getMenuItems = useCallback(() => {
        console.log('getMenuItems - Current stores:', stores);
        console.log('getMenuItems - Group permissions:', groupPermissions);
        console.log('getMenuItems - User role:', user?.role);

        const items = [
            {
                key: '/',
                icon: <DesktopOutlined />,
                label: 'Inventory'
            }
        ];

        // Check user permissions and store list
        const hasStorePermissions = user?.role === 'admin' || 
            (groupPermissions?.permissions && groupPermissions.permissions.length > 0);
        
        // Check for additional feature permissions
        const hasFeatureAccess = (feature) => {
            return user?.role === 'admin' || 
                (groupPermissions?.features && groupPermissions.features.includes(feature));
        };

        console.log('hasStorePermissions:', hasStorePermissions);
        console.log('Available stores:', stores);
        console.log('Feature permissions:', groupPermissions?.features);
        console.log('Access rights:', groupPermissions?.access_rights);

        // Show Branches menu if user has permissions
        if (hasStorePermissions) {
            const branchesItem = {
                key: 'branches',
                icon: <BranchesOutlined />,
                label: 'Branches',
                children: []
            };

            // 如果是管理員，添加新增商店選項
            if (user?.role === 'admin') {
                branchesItem.children.push({
                    key: 'add-store',
                    icon: <PlusOutlined />,
                    label: 'Add Store',
                    className: 'ant-menu-item-add-store',
                    onClick: () => setIsModalVisible(true)
                });
            }

            // 添加商店列表
            const storeItems = stores.map(store => ({
                key: `store-${store.id}`,
                label: store.name,
                icon: <ShopOutlined />,
                children: [
                    {
                        key: `/stores/${store.id}`,
                        label: 'Inventory',
                        icon: <UnorderedListOutlined />,
                        onClick: () => navigate(`/stores/${store.id}`)
                    },
                    {
                        key: `/stores/${store.id}/orders`,
                        label: 'Orders',
                        icon: <ShoppingCartOutlined />,
                        onClick: () => navigate(`/stores/${store.id}/orders`)
                    },
                    {
                        key: `/stores/${store.id}/rma`,
                        label: 'RMA',
                        icon: <RollbackOutlined />,
                        onClick: () => navigate(`/stores/${store.id}/rma`)
                    }
                ]
            }));

            branchesItem.children.push(...storeItems);
            
            // 只有當有商店時才添加 Branches 菜單
            if (branchesItem.children.length > 0) {
                items.push(branchesItem);
            }
        }

        items.push(
            {
                key: '/settings',
                icon: <SettingOutlined />,
                label: 'Settings',
                onClick: () => navigate('/settings')
            },
            {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: 'Logout',
                onClick: handleLogout
            }
        );

        return items;
    }, [stores, groupPermissions, user?.role, navigate, handleLogout, setIsModalVisible]);

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