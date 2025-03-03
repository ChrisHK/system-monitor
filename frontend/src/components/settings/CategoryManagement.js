import React, { useState, useEffect } from 'react';
import {
    Table,
    Button,
    Modal,
    Form,
    Input,
    message,
    Space,
    Alert,
    Typography
} from 'antd';
import {
    EditOutlined,
    PlusOutlined,
    DeleteOutlined,
    FolderOutlined
} from '@ant-design/icons';
import { tagService } from '../../api';

const { Title } = Typography;
const { TextArea } = Input;

const CategoryManagement = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [form] = Form.useForm();

    const fetchCategories = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await tagService.getCategories();
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to fetch categories');
            }
            setCategories(response.categories);
        } catch (error) {
            console.error('Error fetching categories:', error);
            setError(error.message);
            message.error('Failed to load categories');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleAdd = () => {
        setEditingCategory(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (category) => {
        setEditingCategory(category);
        form.setFieldsValue({
            name: category.name,
            description: category.description
        });
        setIsModalVisible(true);
    };

    const handleDelete = async (categoryId) => {
        try {
            setLoading(true);
            const response = await tagService.deleteCategory(categoryId);
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to delete category');
            }
            message.success('Category deleted successfully');
            await fetchCategories();
        } catch (error) {
            console.error('Error deleting category:', error);
            message.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (values) => {
        try {
            setLoading(true);
            setError(null);

            const categoryData = {
                name: values.name.trim(),
                description: values.description?.trim()
            };

            let response;
            if (editingCategory) {
                response = await tagService.updateCategory(editingCategory.id, categoryData);
            } else {
                response = await tagService.createCategory(categoryData);
            }

            if (!response?.success) {
                throw new Error(response?.error || `Failed to ${editingCategory ? 'update' : 'create'} category`);
            }

            message.success(`Category ${editingCategory ? 'updated' : 'created'} successfully`);
            setIsModalVisible(false);
            form.resetFields();
            await fetchCategories();
        } catch (error) {
            console.error('Error saving category:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name'
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description'
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
                    <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(record.id)}
                        disabled={loading}
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
                <Title level={2}>Category Management</Title>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAdd}
                    disabled={loading}
                >
                    Add Category
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
                dataSource={categories}
                rowKey="id"
                loading={loading}
            />

            <Modal
                title={`${editingCategory ? 'Edit' : 'Add'} Category`}
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
                    onFinish={handleSubmit}
                >
                    <Form.Item
                        name="name"
                        label="Category Name"
                        rules={[
                            { required: true, message: 'Please enter category name' },
                            { min: 2, message: 'Name must be at least 2 characters' }
                        ]}
                    >
                        <Input
                            prefix={<FolderOutlined />}
                            placeholder="Enter category name"
                        />
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="Description"
                    >
                        <TextArea
                            placeholder="Enter description"
                            rows={4}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default CategoryManagement; 