import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Space, Tag } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { userApi, storeApi } from '../services/api';

const { Option } = Select;

const UserManagementPage = () => {
    const [users, setUsers] = useState([]);
    const [stores, setStores] = useState([]);
    const [editingUser, setEditingUser] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();

    const fetchUsers = async () => {
        try {
            const response = await userApi.getUsers();
            if (response?.success) {
                setUsers(response.users);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            message.error('Failed to load users');
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

    const handleSubmit = async (values) => {
        try {
            const response = await userApi.updateUser(editingUser.id, values);
            if (response?.success) {
                message.success('User updated successfully');
                setIsModalVisible(false);
                form.resetFields();
                fetchUsers();
            }
        } catch (error) {
            console.error('Error updating user:', error);
            message.error('Failed to update user');
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
            <Table 
                columns={columns} 
                dataSource={users}
                rowKey="id"
            />

            <Modal
                title="Edit User"
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
                        rules={[{ required: true, message: 'Please input username!' }]}
                    >
                        <Input disabled />
                    </Form.Item>

                    <Form.Item
                        name="role"
                        label="Role"
                        rules={[{ required: true, message: 'Please select role!' }]}
                    >
                        <Select>
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