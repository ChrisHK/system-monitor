import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Tag } from 'antd';
import { EditOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { userApi, groupApi } from '../../services/api';

const { Option } = Select;

const DEFAULT_USERS = [
    {
        id: 1,
        username: 'admin',
        role: 'admin',
        group_id: 1,
        is_system: true
    },
    {
        id: 2,
        username: 'user',
        role: 'user',
        group_id: 2,
        is_system: true
    }
];

const UserManagement = () => {
    const [users, setUsers] = useState(DEFAULT_USERS);
    const [groups, setGroups] = useState([]);
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

    const fetchUsers = async () => {
        try {
            const response = await userApi.getUsers();
            if (response?.success) {
                // Merge default users with custom users
                const customUsers = response.users.filter(
                    user => !DEFAULT_USERS.find(du => du.username === user.username)
                );
                setUsers([...DEFAULT_USERS, ...customUsers]);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            message.error('Failed to load users');
            // Fallback to default users
            setUsers(DEFAULT_USERS);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchGroups();
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
        if (user.is_system) {
            message.warning('System users cannot be deleted');
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
                    {record.is_system && <Tag color="gold">System</Tag>}
                </Space>
            )
        },
        {
            title: 'Role',
            dataIndex: 'role',
            key: 'role',
            render: role => (
                <Tag color={role === 'admin' ? 'red' : 'blue'}>
                    {role}
                </Tag>
            )
        },
        {
            title: 'Group',
            dataIndex: 'group_id',
            key: 'group_id',
            render: group_id => {
                const groupName = getGroupName(group_id);
                return (
                    <Tag color={groupName === 'admin' ? 'red' : 'blue'}>
                        {groupName}
                    </Tag>
                );
            }
        },
        {
            title: 'Permitted Stores',
            key: 'permitted_stores',
            render: (_, record) => {
                const group = groups.find(g => g.id === record.group_id);
                return (
                    <Space>
                        {group?.permitted_stores?.map(storeId => (
                            <Tag key={storeId} color="blue">
                                Store {storeId}
                            </Tag>
                        ))}
                    </Space>
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
                        disabled={record.is_system}
                    >
                        Edit
                    </Button>
                    <Button 
                        type="link" 
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(record)}
                        disabled={record.is_system}
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
                            { required: true, message: 'Please input username!' },
                            { 
                                validator: (_, value) => {
                                    if (DEFAULT_USERS.some(u => u.username === value)) {
                                        return Promise.reject('This username is reserved');
                                    }
                                    return Promise.resolve();
                                }
                            }
                        ]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        label="Password"
                        rules={[
                            { 
                                required: !editingUser, 
                                message: 'Please input password!' 
                            }
                        ]}
                    >
                        <Input.Password />
                    </Form.Item>

                    <Form.Item
                        name="group_id"
                        label="Group"
                        rules={[{ required: true, message: 'Please select group!' }]}
                        help="User role will be automatically set based on the selected group"
                    >
                        <Select>
                            {groups.map(group => (
                                <Option key={group.id} value={group.id}>
                                    {group.name} ({group.description})
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