import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Tag, Alert } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { userService, storeService } from '../api';
import { useAuth } from '../contexts/AuthContext';

const { Option } = Select;

const UserManagementPage = () => {
    const [users, setUsers] = useState([]);
    const [stores, setStores] = useState([]);
    const [editingUser, setEditingUser] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [form] = Form.useForm();
    const { refreshUser } = useAuth();

    const fetchUsers = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await userService.getUsers();
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to load users');
            }
            
            setUsers(response.users);
        } catch (error) {
            console.error('Error fetching users:', error);
            setError(error.message);
            message.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const fetchStores = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await storeService.getStores();
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to load stores');
            }
            
            setStores(response.stores);
        } catch (error) {
            console.error('Error fetching stores:', error);
            setError(error.message);
            message.error('Failed to load stores');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchStores();
    }, []);

    const handleEdit = (user) => {
        setEditingUser(user);
        form.setFieldsValue({
            username: user.username,
            role: user.role,
            permitted_stores: user.permitted_stores || []
        });
        setIsModalVisible(true);
    };

    const handleUpdateUser = async (values) => {
        try {
            setLoading(true);
            setError(null);
            
            const response = await userService.updateUser(editingUser.id, values);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to update user');
            }
            
            message.success('User updated successfully');
            setIsModalVisible(false);
            form.resetFields();
            await fetchUsers();
            
            // Refresh current user data if the updated user is the current user
            await refreshUser();
            
        } catch (error) {
            console.error('Error updating user:', error);
            setError(error.message);
            message.error('Failed to update user');
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'Username',
            dataIndex: 'username',
            key: 'username',
        },
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
        },
        {
            title: 'Permitted Stores',
            dataIndex: 'permitted_stores',
            key: 'permitted_stores',
            render: (permitted_stores) => (
                <Space>
                    {(permitted_stores || []).map(storeId => {
                        const store = stores.find(s => s.id === storeId);
                        return store ? (
                            <Tag key={storeId} color="blue">
                                {store.name}
                            </Tag>
                        ) : null;
                    })}
                </Space>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Button 
                        type="link" 
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        disabled={loading}
                    >
                        Edit
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <h2>User Management</h2>
            {error && (
                <Alert
                    message={error}
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}
            <Table 
                columns={columns} 
                dataSource={users}
                rowKey="id"
                loading={loading}
            />

            <Modal
                title="Edit User"
                open={isModalVisible}
                onOk={() => form.submit()}
                onCancel={() => {
                    setIsModalVisible(false);
                    setError(null);
                    form.resetFields();
                }}
                confirmLoading={loading}
            >
                {error && (
                    <Alert
                        message={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                )}
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleUpdateUser}
                >
                    <Form.Item
                        name="username"
                        label="Username"
                        rules={[{ required: true, message: 'Please input username!' }]}
                    >
                        <Input disabled />
                    </Form.Item>

                    <Form.Item
                        name="role"
                        label="Role"
                        rules={[{ required: true, message: 'Please select role!' }]}
                    >
                        <Select disabled={loading}>
                            <Option value="admin">Admin</Option>
                            <Option value="user">User</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="permitted_stores"
                        label="Permitted Stores"
                        rules={[{ required: true, message: 'Please select at least one store!' }]}
                    >
                        <Select
                            mode="multiple"
                            placeholder="Select stores"
                            style={{ width: '100%' }}
                            disabled={loading}
                        >
                            {stores.map(store => (
                                <Option key={store.id} value={store.id}>
                                    {store.name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default UserManagementPage; 