import React, { useState, useEffect } from 'react';
import {
    Card,
    Table,
    Button,
    Modal,
    Form,
    Input,
    Space,
    Tabs,
    message,
    Popconfirm,
    ColorPicker,
    Select
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import tagService from '../services/tagService';
import { useNavigate } from 'react-router-dom';

const { TabPane } = Tabs;

const TagManagementPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isAdmin = user?.group === 'admin' || user?.group_name === 'admin';
    const hasTagManagementAccess = isAdmin || user?.permissions?.main_permissions?.tag_management === true;

    // State
    const [categories, setCategories] = useState([]);
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(false);
    const [categoryModalVisible, setCategoryModalVisible] = useState(false);
    const [tagModalVisible, setTagModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [form] = Form.useForm();

    // Access check effect
    useEffect(() => {
        if (!hasTagManagementAccess) {
            message.error('You do not have permission to access tag management');
            navigate('/');
        }
    }, [hasTagManagementAccess, navigate]);

    // Fetch Data
    const fetchCategories = async () => {
        try {
            setLoading(true);
            const response = await tagService.getAllCategories();
            setCategories(response.data.categories);
        } catch (error) {
            message.error('Failed to fetch categories');
        } finally {
            setLoading(false);
        }
    };

    const fetchTags = async () => {
        try {
            setLoading(true);
            const response = await tagService.getAllTags();
            setTags(response.data.tags);
        } catch (error) {
            message.error('Failed to fetch tags');
        } finally {
            setLoading(false);
        }
    };

    // Data fetch effect
    useEffect(() => {
        if (hasTagManagementAccess) {
            fetchCategories();
            fetchTags();
        }
    }, [hasTagManagementAccess]);

    // Category Handlers
    const handleCategorySubmit = async (values) => {
        try {
            if (editingItem) {
                await tagService.updateCategory(editingItem.id, values);
                message.success('Category updated successfully');
            } else {
                await tagService.createCategory(values);
                message.success('Category created successfully');
            }
            setCategoryModalVisible(false);
            form.resetFields();
            setEditingItem(null);
            fetchCategories();
        } catch (error) {
            message.error(error.response?.data?.error || 'Operation failed');
        }
    };

    const handleDeleteCategory = async (id) => {
        try {
            await tagService.deleteCategory(id);
            message.success('Category deleted successfully');
            fetchCategories();
        } catch (error) {
            message.error(error.response?.data?.error || 'Failed to delete category');
        }
    };

    // Tag Handlers
    const handleTagSubmit = async (values) => {
        try {
            if (editingItem) {
                await tagService.updateTag(editingItem.id, values);
                message.success('Tag updated successfully');
            } else {
                await tagService.createTag(values);
                message.success('Tag created successfully');
            }
            setTagModalVisible(false);
            form.resetFields();
            setEditingItem(null);
            fetchTags();
        } catch (error) {
            message.error(error.response?.data?.error || 'Operation failed');
        }
    };

    const handleDeleteTag = async (id) => {
        try {
            await tagService.deleteTag(id);
            message.success('Tag deleted successfully');
            fetchTags();
        } catch (error) {
            message.error(error.response?.data?.error || 'Failed to delete tag');
        }
    };

    // Column Definitions
    const categoryColumns = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    {isAdmin && (
                        <>
                            <Button
                                icon={<EditOutlined />}
                                onClick={() => {
                                    setEditingItem(record);
                                    form.setFieldsValue(record);
                                    setCategoryModalVisible(true);
                                }}
                            />
                            <Popconfirm
                                title="Are you sure you want to delete this category?"
                                onConfirm={() => handleDeleteCategory(record.id)}
                                icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
                            >
                                <Button icon={<DeleteOutlined />} danger />
                            </Popconfirm>
                        </>
                    )}
                </Space>
            ),
        },
    ];

    const tagColumns = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: 'Category',
            dataIndex: 'category_name',
            key: 'category_name',
        },
        {
            title: 'Color',
            dataIndex: 'color',
            key: 'color',
            render: (color) => (
                <div
                    style={{
                        backgroundColor: color,
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                    }}
                />
            ),
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Button
                        icon={<EditOutlined />}
                        onClick={() => {
                            setEditingItem(record);
                            form.setFieldsValue({
                                ...record,
                                category_id: record.category_id,
                            });
                            setTagModalVisible(true);
                        }}
                    />
                    <Popconfirm
                        title="Are you sure you want to delete this tag?"
                        onConfirm={() => handleDeleteTag(record.id)}
                        icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
                    >
                        <Button icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    if (!hasTagManagementAccess) {
        return null;
    }

    return (
        <div style={{ padding: 24 }}>
            <Card title="Tag Management">
                <Tabs defaultActiveKey="tags">
                    <TabPane tab="Tags" key="tags">
                        <div style={{ marginBottom: 16 }}>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => {
                                    setEditingItem(null);
                                    form.resetFields();
                                    setTagModalVisible(true);
                                }}
                            >
                                Add Tag
                            </Button>
                        </div>
                        <Table
                            columns={tagColumns}
                            dataSource={tags}
                            rowKey="id"
                            loading={loading}
                        />
                    </TabPane>
                    {isAdmin && (
                        <TabPane tab="Categories" key="categories">
                            <div style={{ marginBottom: 16 }}>
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={() => {
                                        setEditingItem(null);
                                        form.resetFields();
                                        setCategoryModalVisible(true);
                                    }}
                                >
                                    Add Category
                                </Button>
                            </div>
                            <Table
                                columns={categoryColumns}
                                dataSource={categories}
                                rowKey="id"
                                loading={loading}
                            />
                        </TabPane>
                    )}
                </Tabs>
            </Card>

            {/* Category Modal */}
            {isAdmin && (
                <Modal
                    title={`${editingItem ? 'Edit' : 'Add'} Category`}
                    open={categoryModalVisible}
                    onCancel={() => {
                        setCategoryModalVisible(false);
                        form.resetFields();
                        setEditingItem(null);
                    }}
                    footer={null}
                >
                    <Form
                        form={form}
                        onFinish={handleCategorySubmit}
                        layout="vertical"
                    >
                        <Form.Item
                            name="name"
                            label="Name"
                            rules={[{ required: true, message: 'Please input category name!' }]}
                        >
                            <Input />
                        </Form.Item>
                        <Form.Item name="description" label="Description">
                            <Input.TextArea />
                        </Form.Item>
                        <Form.Item>
                            <Space>
                                <Button type="primary" htmlType="submit">
                                    {editingItem ? 'Update' : 'Create'}
                                </Button>
                                <Button
                                    onClick={() => {
                                        setCategoryModalVisible(false);
                                        form.resetFields();
                                        setEditingItem(null);
                                    }}
                                >
                                    Cancel
                                </Button>
                            </Space>
                        </Form.Item>
                    </Form>
                </Modal>
            )}

            {/* Tag Modal */}
            <Modal
                title={`${editingItem ? 'Edit' : 'Add'} Tag`}
                open={tagModalVisible}
                onCancel={() => {
                    setTagModalVisible(false);
                    form.resetFields();
                    setEditingItem(null);
                }}
                footer={null}
            >
                <Form
                    form={form}
                    onFinish={handleTagSubmit}
                    layout="vertical"
                >
                    <Form.Item
                        name="name"
                        label="Name"
                        rules={[{ required: true, message: 'Please input tag name!' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="category_id"
                        label="Category"
                        rules={[{ required: true, message: 'Please select a category!' }]}
                    >
                        <Select>
                            {categories.map(category => (
                                <Select.Option key={category.id} value={category.id}>
                                    {category.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                    <Form.Item name="color" label="Color" initialValue="#1890ff">
                        <ColorPicker />
                    </Form.Item>
                    <Form.Item name="description" label="Description">
                        <Input.TextArea />
                    </Form.Item>
                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                {editingItem ? 'Update' : 'Create'}
                            </Button>
                            <Button
                                onClick={() => {
                                    setTagModalVisible(false);
                                    form.resetFields();
                                    setEditingItem(null);
                                }}
                            >
                                Cancel
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default TagManagementPage; 