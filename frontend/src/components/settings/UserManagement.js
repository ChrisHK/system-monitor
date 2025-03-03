import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Tag, Alert, Spin } from 'antd';
import { EditOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { userService, storeService } from '../../api';

const { Option } = Select;

const DEFAULT_USERS = [
    {
        id: 1,
        username: 'admin',
        role: 'admin',
        group_id: 1,  // admin group id
        group_name: 'admin',  // admin group name
        is_system: true,
        permitted_stores: []  // will be updated from backend
    }
];

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [stores, setStores] = useState([]);
    const [editingUser, setEditingUser] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchGroups = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await userService.getGroups();
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to load groups');
            }
            
            const groupsList = response.data?.groups || response.groups;
            if (!Array.isArray(groupsList)) {
                throw new Error('Invalid groups data format');
            }
            
            setGroups(groupsList);
        } catch (error) {
            console.error('Error fetching groups:', error);
            setError(error.message || 'Failed to load groups');
            throw error; // Re-throw to handle in the caller
        } finally {
            setLoading(false);
        }
    };

    const fetchStores = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await storeService.getStores();
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to load stores');
            }
            
            const storesList = response.data?.stores || response.stores;
            if (!Array.isArray(storesList)) {
                throw new Error('Invalid stores data format');
            }
            
            setStores(storesList);
        } catch (error) {
            console.error('Error fetching stores:', error);
            setError(error.message || 'Failed to load stores');
            throw error; // Re-throw to handle in the caller
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await userService.getUsers();
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to load users');
            }
            
            const usersList = response.data?.users || response.users;
            if (!Array.isArray(usersList)) {
                throw new Error('Invalid users data format');
            }

            // Find admin user from backend data
            const backendAdmin = usersList.find(user => user.username === 'admin');
            
            if (backendAdmin) {
                // Update admin user with backend data while preserving is_system flag
                const adminUser = {
                    ...backendAdmin,
                    is_system: true,
                    role: 'admin',  // Ensure admin role
                    group_name: backendAdmin.group_name || 'admin'  // Use backend group name or fallback
                };
                
                // Get all other users from backend
                const otherUsers = usersList.filter(user => user.username !== 'admin');
                
                // Set all users with admin first
                setUsers([adminUser, ...otherUsers]);
            } else {
                // If no admin in backend, use default admin user
                const adminGroup = groups.find(g => g.name === 'admin');
                if (!adminGroup) {
                    throw new Error('Admin group not found');
                }
                
                const defaultAdmin = {
                    ...DEFAULT_USERS[0],
                    group_id: adminGroup.id,
                    group_name: 'admin',
                    permitted_stores: adminGroup.permitted_stores || []
                };
                
                // Set all users with default admin first
                setUsers([defaultAdmin, ...usersList]);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            setError(error.message || 'Failed to load users');
            
            // Fallback to admin user only with current groups data
            const adminGroup = groups.find(g => g.name === 'admin');
            if (adminGroup) {
                const defaultAdmin = {
                    ...DEFAULT_USERS[0],
                    group_id: adminGroup.id,
                    group_name: 'admin',
                    permitted_stores: adminGroup.permitted_stores || []
                };
                setUsers([defaultAdmin]);
            } else {
                setUsers([]);
            }
        } finally {
            setLoading(false);
        }
    };

    // Fetch groups, stores, and users
    useEffect(() => {
        const initData = async () => {
            try {
                setLoading(true);
                setError('');
                await fetchGroups();   // Get groups first
                await fetchStores();   // Then get stores
                await fetchUsers();    // Finally get users
            } catch (error) {
                console.error('Error initializing data:', error);
                setError(error.message || 'Failed to initialize data');
            } finally {
                setLoading(false);
            }
        };
        initData();
    }, []);

    const handleAdd = () => {
        setEditingUser(null);
        setError('');
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (user) => {
        if (user.is_system) {
            message.warning('System users cannot be edited');
            return;
        }
        setEditingUser(user);
        setError('');
        form.setFieldsValue({
            username: user.username,
            role: user.role,
            group_id: user.group_id
        });
        setIsModalVisible(true);
    };

    const handleSubmit = async (values) => {
        try {
            setLoading(true);
            setError('');
            
            // Get the selected group's role
            const selectedGroup = groups.find(g => g.id === values.group_id);
            if (!selectedGroup) {
                throw new Error('Selected group not found');
            }

            // Ensure user role matches group role
            const userData = {
                ...values,
                role: selectedGroup.name === 'admin' ? 'admin' : 'user'
            };

            let response;
            if (editingUser) {
                // Update user data
                response = await userService.updateUser(editingUser.id, userData);
                
                // If password is provided, update it
                if (values.password) {
                    await userService.updateUserPassword(editingUser.id, values.password);
                }
            } else {
                response = await userService.createUser(userData);
            }

            if (!response?.success) {
                throw new Error(response?.error || `Failed to ${editingUser ? 'update' : 'create'} user`);
            }

            message.success(`User ${editingUser ? 'updated' : 'created'} successfully`);
            setIsModalVisible(false);
            form.resetFields();
            await fetchUsers();
        } catch (error) {
            console.error('Error saving user:', error);
            setError(error.message || `Failed to ${editingUser ? 'update' : 'create'} user`);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (user) => {
        if (user.username === 'admin') {
            message.warning('Admin user cannot be deleted');
            return;
        }
        setUserToDelete(user);
        setDeleteConfirmVisible(true);
    };

    const confirmDelete = async () => {
        try {
            setLoading(true);
            setError('');
            
            const response = await userService.deleteUser(userToDelete.id);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to delete user');
            }
            
            message.success('User deleted successfully');
            await fetchUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            setError(error.message || 'Failed to delete user');
        } finally {
            setLoading(false);
            setDeleteConfirmVisible(false);
            setUserToDelete(null);
        }
    };

    // Get group name for display
    const getGroupName = (group_id) => {
        // If it's admin user, always return 'admin' as group name
        const user = users.find(u => u.group_id === group_id);
        if (user?.username === 'admin') {
            return 'admin';
        }
        
        // For other users, find group name from groups
        const group = groups.find(g => g.id === group_id);
        return group ? group.name : 'Unknown';
    };

    const columns = [
        {
            title: 'Username',
            dataIndex: 'username',
            key: 'username',
            render: (text, record) => (
                <Space>
                    {text}
                    {record.username === 'admin' && (
                        <Tag color="blue">System User</Tag>
                    )}
                </Space>
            )
        },
        {
            title: 'Group',
            dataIndex: 'group_name',
            key: 'group_name'
        },
        {
            title: 'Store Permissions',
            key: 'store_permissions',
            render: (_, record) => {
                // 如果是 admin 用戶，顯示完整訪問權限
                if (record.username === 'admin' || record.group_name === 'admin') {
                    return <Tag color="blue">All Stores - Full Access</Tag>;
                }

                // 獲取用戶群組的商店權限
                const group = groups.find(g => g.id === record.group_id);
                if (!group) return null;

                const permissions = group.store_permissions || {};
                return (
                    <div style={{ maxWidth: 400 }}>
                        {Object.entries(permissions).map(([storeId, features]) => {
                            const store = stores.find(s => s.id === parseInt(storeId));
                            if (!store) return null;
                            
                            return (
                                <div key={storeId} style={{ marginBottom: 8 }}>
                                    <strong>{store.name}:</strong>
                                    <br />
                                    {Object.entries(features).map(([feature, hasAccess]) => 
                                        hasAccess ? (
                                            <Tag key={feature} color="green" style={{ margin: '4px' }}>
                                                {feature}
                                            </Tag>
                                        ) : null
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            }
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
                        disabled={loading || record.is_system}
                    >
                        Edit
                    </Button>
                    <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(record)}
                        disabled={loading || record.is_system}
                    >
                        Delete
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>User Management</h2>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAdd}
                    disabled={loading}
                >
                    Add User
                </Button>
            </div>

            {error && (
                <Alert
                    message="Error"
                    description={error}
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
                title={editingUser ? 'Edit User' : 'Add User'}
                open={isModalVisible}
                onOk={() => form.submit()}
                onCancel={() => {
                    setIsModalVisible(false);
                    setError('');
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
                    onFinish={handleSubmit}
                >
                    <Form.Item
                        name="username"
                        label="Username"
                        rules={[{ required: true, message: 'Please input username!' }]}
                    >
                        <Input disabled={loading} />
                    </Form.Item>

                    <Form.Item
                        name="group_id"
                        label="Group"
                        rules={[{ required: true, message: 'Please select group!' }]}
                    >
                        <Select disabled={loading}>
                            {groups.map(group => (
                                <Option key={group.id} value={group.id}>
                                    {group.name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    {editingUser ? (
                        <Form.Item
                            name="password"
                            label="New Password"
                            rules={[
                                {
                                    min: 6,
                                    message: 'Password must be at least 6 characters!'
                                }
                            ]}
                            extra="Leave blank to keep current password"
                        >
                            <Input.Password disabled={loading} />
                        </Form.Item>
                    ) : (
                        <Form.Item
                            name="password"
                            label="Password"
                            rules={[
                                { required: true, message: 'Please input password!' },
                                {
                                    min: 6,
                                    message: 'Password must be at least 6 characters!'
                                }
                            ]}
                        >
                            <Input.Password disabled={loading} />
                        </Form.Item>
                    )}
                </Form>
            </Modal>

            <Modal
                title="Delete User"
                open={deleteConfirmVisible}
                onOk={confirmDelete}
                onCancel={() => {
                    setDeleteConfirmVisible(false);
                    setUserToDelete(null);
                    setError('');
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
                <p>Are you sure you want to delete user "{userToDelete?.username}"?</p>
                <p>This action cannot be undone.</p>
            </Modal>
        </div>
    );
};

export default UserManagement; 