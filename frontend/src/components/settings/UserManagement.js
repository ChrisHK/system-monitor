import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Tag } from 'antd';
import { EditOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { userApi, groupApi, storeApi } from '../../services/api';

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

    const fetchGroups = async () => {
        try {
            const response = await groupApi.getGroups();
            if (response?.success) {
                setGroups(response.groups);
            }
        } catch (error) {
            console.error('Error fetching groups:', error);
            message.error('Failed to load groups');
        }
    };

    const fetchStores = async () => {
        try {
            const response = await storeApi.getStores();
            if (response?.success) {
                setStores(response.stores);
            }
        } catch (error) {
            console.error('Error fetching stores:', error);
            message.error('Failed to load stores');
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await userApi.getUsers();
            if (response?.success) {
                // Find admin user from backend
                const backendAdmin = response.users.find(user => user.username === 'admin');
                
                if (backendAdmin) {
                    // Update admin user with backend data while preserving is_system flag
                    const adminUser = {
                        ...backendAdmin,
                        is_system: true,
                        role: 'admin',  // Ensure admin role
                        group_name: backendAdmin.group_name || 'admin'  // Use backend group name or fallback
                    };
                    
                    // Get all other users from backend
                    const otherUsers = response.users.filter(user => user.username !== 'admin');
                    
                    // Set all users with admin first
                    setUsers([adminUser, ...otherUsers]);
                } else {
                    // If no admin in backend, use default admin user
                    const adminGroup = groups.find(g => g.name === 'admin');
                    const defaultAdmin = {
                        ...DEFAULT_USERS[0],
                        group_id: adminGroup?.id || 1,
                        group_name: 'admin',
                        permitted_stores: adminGroup?.permitted_stores || []
                    };
                    
                    // Get all other users from backend
                    const otherUsers = response.users;
                    
                    // Set all users with default admin first
                    setUsers([defaultAdmin, ...otherUsers]);
                }
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            message.error('Failed to load users');
            // Fallback to admin user only with current groups data
            const adminGroup = groups.find(g => g.name === 'admin');
            const defaultAdmin = {
                ...DEFAULT_USERS[0],
                group_id: adminGroup?.id || 1,
                group_name: 'admin',
                permitted_stores: adminGroup?.permitted_stores || []
            };
            setUsers([defaultAdmin]);
        }
    };

    // Fetch groups, stores, and users
    useEffect(() => {
        const initData = async () => {
            await fetchGroups();   // Get groups first
            await fetchStores();   // Then get stores
            await fetchUsers();    // Finally get users
        };
        initData();
    }, []);

    const handleAdd = () => {
        setEditingUser(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (user) => {
        if (user.is_system) {
            message.warning('System users cannot be edited');
            return;
        }
        setEditingUser(user);
        form.setFieldsValue({
            username: user.username,
            role: user.role,
            group_id: user.group_id
        });
        setIsModalVisible(true);
    };

    const handleSubmit = async (values) => {
        try {
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
                response = await userApi.updateUser(editingUser.id, userData);
            } else {
                response = await userApi.createUser(userData);
            }

            if (response?.success) {
                message.success(`User ${editingUser ? 'updated' : 'created'} successfully`);
                setIsModalVisible(false);
                form.resetFields();
                fetchUsers();
            }
        } catch (error) {
            console.error('Error saving user:', error);
            message.error(error.response?.data?.error || `Failed to ${editingUser ? 'update' : 'create'} user`);
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
            const response = await userApi.deleteUser(userToDelete.id);
            if (response?.success) {
                message.success('User deleted successfully');
                await fetchUsers();
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            message.error(error.response?.data?.error || 'Failed to delete user');
        } finally {
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
                                    <Space>
                                        {features.inventory && <Tag color="blue">Inventory</Tag>}
                                        {features.orders && <Tag color="green">Orders</Tag>}
                                        {features.rma && <Tag color="orange">RMA</Tag>}
                                    </Space>
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
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        disabled={record.username === 'admin'}
                    >
                        Edit
                    </Button>
                    <Button
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(record)}
                        disabled={record.username === 'admin'}
                    >
                        Delete
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />}
                    onClick={handleAdd}
                >
                    Add User
                </Button>
            </div>

            <Table 
                columns={columns} 
                dataSource={users}
                rowKey="id"
            />

            <Modal
                title={editingUser ? "Edit User" : "Add User"}
                open={isModalVisible}
                onOk={() => form.submit()}
                onCancel={() => {
                    setIsModalVisible(false);
                    form.resetFields();
                }}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <Form.Item
                        name="username"
                        label="Username"
                        rules={[
                            { required: true, message: 'Please input username' },
                            { min: 3, message: 'Username must be at least 3 characters' }
                        ]}
                    >
                        <Input />
                    </Form.Item>

                    {!editingUser && (
                        <Form.Item
                            name="password"
                            label="Password"
                            rules={[
                                { required: true, message: 'Please input password' },
                                { min: 6, message: 'Password must be at least 6 characters' }
                            ]}
                        >
                            <Input.Password />
                        </Form.Item>
                    )}

                    <Form.Item
                        name="group_id"
                        label="Group"
                        rules={[{ required: true, message: 'Please select a group' }]}
                    >
                        <Select>
                            {groups.map(group => (
                                <Option key={group.id} value={group.id}>
                                    {group.name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Confirm Delete"
                open={deleteConfirmVisible}
                onOk={confirmDelete}
                onCancel={() => {
                    setDeleteConfirmVisible(false);
                    setUserToDelete(null);
                }}
                okText="Yes, delete"
                cancelText="No, cancel"
                okButtonProps={{ danger: true }}
            >
                <p>Are you sure you want to delete the user "{userToDelete?.username}"?</p>
                <p>This action cannot be undone.</p>
            </Modal>
        </div>
    );
};

export default UserManagement; 