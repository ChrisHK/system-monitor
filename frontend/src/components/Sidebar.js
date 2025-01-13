import React, { useState, useEffect, useCallback } from 'react';
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
    BranchesOutlined
} from '@ant-design/icons';
import { storeApi } from '../services/api';
import './Sidebar.css';

const { Sider } = Layout;

const Sidebar = ({ collapsed, setCollapsed }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, user } = useAuth();
    const [stores, setStores] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();

    const handleLogout = useCallback(() => {
        console.log('Logging out...');
        logout();
        navigate('/login');
    }, [logout, navigate]);

    const fetchStores = async () => {
        try {
            console.log('Fetching stores for sidebar...');
            const response = await storeApi.getStores();
            console.log('Sidebar stores response:', response);

            if (response?.success) {
                const userStoreId = user?.store_id?.toString();
                const filteredStores = user?.role === 'admin' 
                    ? response.stores 
                    : response.stores.filter(store => {
                        const storeId = store.id?.toString();
                        console.log('Comparing store IDs:', { storeId, userStoreId });
                        return storeId === userStoreId;
                    });
                
                console.log('Filtered stores:', filteredStores);
                setStores(filteredStores);
            } else {
                throw new Error(response?.error || 'Failed to load stores');
            }
        } catch (error) {
            console.error('Error fetching stores:', error);
            message.error('Failed to load stores');
        }
    };

    useEffect(() => {
        fetchStores();
    }, []);

    const handleAddStore = async (values) => {
        try {
            console.log('Creating new store:', values);
            const response = await storeApi.createStore(values);
            console.log('Create store response:', response);

            if (response?.success) {
                message.success('Store added successfully');
                form.resetFields();
                setIsModalVisible(false);
                fetchStores();
            } else {
                throw new Error(response?.error || 'Failed to add store');
            }
        } catch (error) {
            console.error('Error adding store:', error);
            message.error(error.message || 'Failed to add store');
        }
    };

    const getSelectedKey = () => {
        const path = location.pathname;
        if (path === '/') return '/inventory';
        if (path.startsWith('/stores/')) return path;
        return path;
    };

    const getMenuItems = useCallback(() => {
        const items = [
            {
                key: '/inventory',
                icon: <DatabaseOutlined />,
                label: 'Inventory',
                onClick: () => navigate('/inventory')
            }
        ];

        // Add Branches submenu if there are stores
        if (stores.length > 0) {
            items.push({
                key: 'branches',
                icon: <BranchesOutlined />,
                label: 'Branches',
                children: stores.map(store => ({
                    key: `/stores/${store.id}`,
                    label: store.name,
                    onClick: () => {
                        console.log(`Navigating to store ${store.id}`);
                        navigate(`/stores/${store.id}`);
                    }
                }))
            });
        }

        // Add other menu items
        items.push(
            {
                key: '/outbound',
                icon: <ExportOutlined />,
                label: 'Outbound',
                onClick: () => {
                    console.log('Navigating to outbound page');
                    navigate('/outbound');
                }
            }
        );

        // Add settings for admin
        if (user?.role === 'admin') {
            items.push({
                key: '/settings',
                icon: <SettingOutlined />,
                label: 'Settings',
                onClick: () => navigate('/settings')
            });
        }

        // Add logout
        items.push({
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Logout',
            onClick: handleLogout
        });

        return items;
    }, [stores, user?.role, navigate, handleLogout]);

    const handleMenuClick = (e) => {
        if (e.key === 'logout') {
            handleLogout();
        } else if (e.key === 'add-store') {
            setIsModalVisible(true);
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