import React, { useState, useEffect } from 'react';
import { Layout, Menu, Modal, Form, Input, message } from 'antd';
import { PlusOutlined, DesktopOutlined, ShopOutlined, ExportOutlined, SettingOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './Sidebar.css';

const { Sider } = Layout;

const Sidebar = () => {
    const [collapsed, setCollapsed] = useState(false);
    const [stores, setStores] = useState([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const navigate = useNavigate();
    const location = useLocation();

    const fetchStores = async () => {
        try {
            const response = await axios.get('http://192.168.0.10:3000/api/stores');
            if (response.data.success) {
                setStores(response.data.stores);
            }
        } catch (error) {
            console.error('Error fetching stores:', error);
            message.error('Failed to fetch stores');
        }
    };

    useEffect(() => {
        fetchStores();
    }, []);

    const handleAddStore = async (values) => {
        try {
            const response = await axios.post('http://192.168.0.10:3000/api/stores', values);
            if (response.data.success) {
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
        if (path === '/') return '/';
        if (path.startsWith('/store/')) return path;
        return path;
    };

    const items = [
        {
            key: '/',
            icon: <DesktopOutlined />,
            label: 'Inventory'
        },
        {
            key: 'branches',
            icon: <ShopOutlined />,
            label: 'Branches',
            children: [
                {
                    key: 'add-store',
                    icon: <PlusOutlined />,
                    label: 'Add Store',
                    className: 'ant-menu-item-add-store',
                    onClick: () => setIsModalVisible(true)
                },
                ...stores.map(store => ({
                    key: `/store/${store.id}`,
                    label: store.name
                }))
            ]
        },
        {
            key: '/outbound',
            icon: <ExportOutlined />,
            label: 'Outbound'
        },
        {
            key: '/settings',
            icon: <SettingOutlined />,
            label: 'Settings'
        }
    ];

    return (
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
                selectedKeys={[getSelectedKey()]}
                defaultOpenKeys={['branches']}
                mode="inline"
                items={items}
                onClick={({ key }) => {
                    if (key !== 'add-store') {
                        navigate(key);
                    }
                }}
            />

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
        </Sider>
    );
};

export default Sidebar; 