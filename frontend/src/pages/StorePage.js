import React, { useState, useEffect } from 'react';
import {
    Table,
    Button,
    Modal,
    Form,
    Input,
    message,
    Popconfirm,
    Space
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL;

const StorePage = () => {
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingStore, setEditingStore] = useState(null);
    const [form] = Form.useForm();

    // Fetch stores
    const fetchStores = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_BASE_URL}/stores`);
            if (response.data.success) {
                setStores(response.data.stores);
            }
        } catch (error) {
            console.error('Error fetching stores:', error);
            message.error('Failed to fetch stores');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStores();
    }, []);

    // Handle form submission
    const handleSubmit = async (values) => {
        try {
            if (editingStore) {
                // Update existing store
                const response = await axios.put(
                    `${API_BASE_URL}/stores/${editingStore.id}`,
                    values
                );
                if (response.data.success) {
                    message.success('Store updated successfully');
                    fetchStores();
                }
            } else {
                // Create new store
                const response = await axios.post(
                    `${API_BASE_URL}/stores`,
                    values
                );
                if (response.data.success) {
                    message.success('Store created successfully');
                    fetchStores();
                }
            }
            setModalVisible(false);
            form.resetFields();
            setEditingStore(null);
        } catch (error) {
            console.error('Error saving store:', error);
            message.error(error.response?.data?.error || 'Failed to save store');
        }
    };

    // Handle store deletion
    const handleDelete = async (id) => {
        try {
            const response = await axios.delete(`${API_BASE_URL}/stores/${id}`);
            if (response.data.success) {
                message.success('Store deleted successfully');
                fetchStores();
            }
        } catch (error) {
            console.error('Error deleting store:', error);
            message.error('Failed to delete store');
        }
    };

    // Handle edit button click
    const handleEdit = (record) => {
        setEditingStore(record);
        form.setFieldsValue(record);
        setModalVisible(true);
    };

    // Table columns
    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            sorter: (a, b) => a.name.localeCompare(b.name)
        },
        {
            title: 'Address',
            dataIndex: 'address',
            key: 'address'
        },
        {
            title: 'Phone',
            dataIndex: 'phone',
            key: 'phone'
        },
        {
            title: 'Contact Person',
            dataIndex: 'contact_person',
            key: 'contact_person'
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email'
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Button
                        type="primary"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    >
                        Edit
                    </Button>
                    <Popconfirm
                        title="Are you sure you want to delete this store?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Yes"
                        cancelText="No"
                    >
                        <Button type="primary" danger icon={<DeleteOutlined />}>
                            Delete
                        </Button>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                        setEditingStore(null);
                        form.resetFields();
                        setModalVisible(true);
                    }}
                >
                    Add Store
                </Button>
            </div>

            <Table
                columns={columns}
                dataSource={stores}
                rowKey="id"
                loading={loading}
            />

            <Modal
                title={editingStore ? 'Edit Store' : 'Add Store'}
                open={modalVisible}
                onCancel={() => {
                    setModalVisible(false);
                    setEditingStore(null);
                    form.resetFields();
                }}
                footer={null}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <Form.Item
                        name="name"
                        label="Store Name"
                        rules={[
                            {
                                required: true,
                                message: 'Please input the store name!'
                            }
                        ]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        name="address"
                        label="Address"
                    >
                        <Input.TextArea />
                    </Form.Item>

                    <Form.Item
                        name="phone"
                        label="Phone"
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        name="contact_person"
                        label="Contact Person"
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        name="email"
                        label="Email"
                        rules={[
                            {
                                type: 'email',
                                message: 'Please input a valid email address!'
                            }
                        ]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                {editingStore ? 'Update' : 'Create'}
                            </Button>
                            <Button onClick={() => {
                                setModalVisible(false);
                                setEditingStore(null);
                                form.resetFields();
                            }}>
                                Cancel
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default StorePage; 