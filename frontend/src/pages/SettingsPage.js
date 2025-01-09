import React, { useState, useEffect } from 'react';
import { Tabs, Table, Button, Modal, Form, Input, Popconfirm, message } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';

const { TabPane } = Tabs;

const SettingsPage = () => {
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingStore, setEditingStore] = useState(null);
    const [form] = Form.useForm();

    const fetchStores = async () => {
        try {
            setLoading(true);
            console.log('Fetching stores...');
            const response = await axios.get('http://192.168.0.10:4000/api/stores', {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            console.log('Response:', response.data);
            if (response.data.success) {
                setStores(response.data.stores);
                console.log('Stores set:', response.data.stores);
            } else {
                console.log('Failed to fetch stores:', response.data.error);
                message.error('Failed to fetch stores: ' + response.data.error);
            }
        } catch (error) {
            console.error('Error fetching stores:', error);
            message.error('Failed to fetch stores: ' + (error.response?.data?.error || error.message));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStores();
    }, []);

    const handleEdit = (record) => {
        setEditingStore(record);
        form.setFieldsValue(record);
        setEditModalVisible(true);
    };

    const handleDelete = async (id) => {
        try {
            const response = await axios.delete(`http://192.168.0.10:4000/api/stores/${id}`, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            if (response.data.success) {
                message.success('Store deleted successfully');
                fetchStores();
            }
        } catch (error) {
            console.error('Error deleting store:', error);
            message.error('Failed to delete store');
        }
    };

    const handleUpdate = async (values) => {
        try {
            const response = await axios.put(`http://192.168.0.10:4000/api/stores/${editingStore.id}`, values, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            if (response.data.success) {
                message.success('Store updated successfully');
                setEditModalVisible(false);
                form.resetFields();
                fetchStores();
            }
        } catch (error) {
            console.error('Error updating store:', error);
            message.error('Failed to update store');
        }
    };

    const columns = [
        {
            title: 'Store Name',
            dataIndex: 'name',
            key: 'name',
            width: 200
        },
        {
            title: 'Address',
            dataIndex: 'address',
            key: 'address',
            width: 300
        },
        {
            title: 'Phone',
            dataIndex: 'phone',
            key: 'phone',
            width: 150
        },
        {
            title: 'Email',
            dataIndex: 'email',
            key: 'email',
            width: 200
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
            width: 300,
            render: (text) => text || 'N/A'
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 120,
            render: (_, record) => (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                        type="link"
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
                        <Button
                            type="link"
                            danger
                            icon={<DeleteOutlined />}
                        >
                            Delete
                        </Button>
                    </Popconfirm>
                </div>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <Tabs defaultActiveKey="stores">
                <TabPane tab="Store Management" key="stores">
                    <div style={{ marginBottom: 16 }}>
                        <h2>Store List</h2>
                    </div>
                    <Table
                        columns={columns}
                        dataSource={stores}
                        rowKey="id"
                        loading={loading}
                        scroll={{ x: 1500 }}
                        pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            pageSizeOptions: ['10', '20', '50']
                        }}
                    />
                </TabPane>
            </Tabs>

            <Modal
                title="Edit Store"
                open={editModalVisible}
                onOk={() => form.submit()}
                onCancel={() => {
                    setEditModalVisible(false);
                    form.resetFields();
                }}
                maskClosable={false}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleUpdate}
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
        </div>
    );
};

export default SettingsPage; 