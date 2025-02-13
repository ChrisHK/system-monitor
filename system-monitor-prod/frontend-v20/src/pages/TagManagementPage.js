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
    Select,
    Collapse,
    Tag,
    Typography,
    List,
    Input as AntInput
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    ExclamationCircleOutlined,
    SearchOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import tagService from '../services/tagService';
import { useNavigate } from 'react-router-dom';

const { TabPane } = Tabs;
const { Panel } = Collapse;
const { Title, Text } = Typography;
const { Search } = AntInput;

const TagManagementPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const isAdmin = user?.group === 'admin' || user?.group_name === 'admin';
    const hasTagManagementAccess = isAdmin || user?.permissions?.main_permissions?.tag_management === true;

    // State
    const [categories, setCategories] = useState([]);
    const [tags, setTags] = useState({});
    const [loading, setLoading] = useState(false);
    const [categoryModalVisible, setCategoryModalVisible] = useState(false);
    const [tagModalVisible, setTagModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [form] = Form.useForm();
    const [searchText, setSearchText] = useState('');
    const [expandedCategories, setExpandedCategories] = useState([]);

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
            // Transform the tags data into a category-based structure
            const tagsByCategory = {};
            if (response?.data?.tags) {
                response.data.tags.forEach(tag => {
                    if (!tagsByCategory[tag.category_id]) {
                        tagsByCategory[tag.category_id] = [];
                    }
                    tagsByCategory[tag.category_id].push(tag);
                });
            }
            setTags(tagsByCategory);
        } catch (error) {
            console.error('Error fetching tags:', error);
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

    // Search and Filter
    const handleSearch = (value) => {
        setSearchText(value.toLowerCase());
        // 只展開包含匹配標籤的分類
        if (value) {
            const matchingCategories = categories.filter(category => {
                const categoryTags = tags[category.id] || [];
                return categoryTags.some(tag => 
                    tag.name.toLowerCase().includes(value.toLowerCase()) ||
                    tag.description?.toLowerCase().includes(value.toLowerCase())
                );
            });
            setExpandedCategories(matchingCategories.map(cat => cat.id));
        } else {
            setExpandedCategories([]);
        }
    };

    const filterTags = (categoryId) => {
        const categoryTags = tags[categoryId] || [];
        if (!searchText) return categoryTags;

        return categoryTags.filter(tag => 
            tag.name.toLowerCase().includes(searchText) ||
            tag.description?.toLowerCase().includes(searchText)
        );
    };

    // 獲取所有匹配的標籤
    const getAllMatchedTags = () => {
        if (!searchText) return null;

        const allMatches = [];
        categories.forEach(category => {
            const matchedTags = filterTags(category.id);
            if (matchedTags.length > 0) {
                allMatches.push({
                    category,
                    tags: matchedTags
                });
            }
        });

        return allMatches.length > 0 ? allMatches : null;
    };

    // 渲染搜索結果
    const renderSearchResults = () => {
        const matches = getAllMatchedTags();
        if (!matches) return null;

        return (
            <Card title="Search Results" size="small" style={{ marginBottom: 16 }}>
                <List
                    dataSource={matches}
                    renderItem={({ category, tags }) => (
                        <List.Item>
                            <div style={{ width: '100%' }}>
                                <Text strong>{category.name}</Text>
                                <div style={{ marginTop: 8 }}>
                                    <Space wrap>
                                        {tags.map(tag => (
                                            <Tag
                                                key={tag.id}
                                                color={tag.color || '#1890ff'}
                                                style={{ cursor: 'pointer' }}
                                                onClick={() => {
                                                    setEditingItem(tag);
                                                    form.setFieldsValue({
                                                        ...tag,
                                                        category_id: tag.category_id
                                                    });
                                                    setTagModalVisible(true);
                                                }}
                                            >
                                                <Space>
                                                    {tag.name}
                                                    {tag.description && (
                                                        <Text type="secondary" style={{ fontSize: '12px' }}>
                                                            - {tag.description}
                                                        </Text>
                                                    )}
                                                </Space>
                                            </Tag>
                                        ))}
                                    </Space>
                                </div>
                            </div>
                        </List.Item>
                    )}
                />
            </Card>
        );
    };

    // Render Tag List
    const renderTagList = (categoryId) => {
        const filteredTags = filterTags(categoryId);
        
        return (
            <List
                size="small"
                dataSource={filteredTags}
                renderItem={tag => (
                    <List.Item
                        key={tag.id}
                        actions={[
                            <Button
                                type="link"
                                icon={<EditOutlined />}
                                onClick={() => {
                                    setEditingItem(tag);
                                    form.setFieldsValue({
                                        ...tag,
                                        category_id: tag.category_id
                                    });
                                    setTagModalVisible(true);
                                }}
                            >
                                Edit
                            </Button>,
                            <Popconfirm
                                title="Are you sure you want to delete this tag?"
                                onConfirm={() => handleDeleteTag(tag.id)}
                                icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
                            >
                                <Button type="link" danger icon={<DeleteOutlined />}>
                                    Delete
                                </Button>
                            </Popconfirm>
                        ]}
                    >
                        <Space>
                            <div
                                style={{
                                    width: 16,
                                    height: 16,
                                    backgroundColor: tag.color || '#1890ff',
                                    borderRadius: 4,
                                    marginRight: 8
                                }}
                            />
                            <Text strong>{tag.name}</Text>
                            {tag.description && (
                                <Text type="secondary">- {tag.description}</Text>
                            )}
                        </Space>
                    </List.Item>
                )}
            />
        );
    };

    if (!hasTagManagementAccess) {
        return null;
    }

    return (
        <div style={{ padding: 24 }}>
            <Card>
                <Tabs
                    defaultActiveKey="tags"
                    onChange={(key) => navigate(`/settings/${key}`)}
                    items={[
                        {
                            key: 'stores',
                            label: 'Store Management',
                        },
                        {
                            key: 'groups',
                            label: 'Group Management',
                        },
                        {
                            key: 'users',
                            label: 'User Management',
                        },
                        {
                            key: 'tags',
                            label: 'Tag Management',
                        }
                    ]}
                />

                <div style={{ marginTop: 16 }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <Space style={{ marginBottom: 16 }}>
                            <Search
                                placeholder="Search tags..."
                                allowClear
                                onSearch={handleSearch}
                                onChange={e => handleSearch(e.target.value)}
                                style={{ width: 300 }}
                            />
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
                            {isAdmin && (
                                <Button
                                    icon={<PlusOutlined />}
                                    onClick={() => {
                                        setEditingItem(null);
                                        form.resetFields();
                                        setCategoryModalVisible(true);
                                    }}
                                >
                                    Add Category
                                </Button>
                            )}
                        </Space>

                        {/* 搜索結果區域 */}
                        {renderSearchResults()}

                        {/* 分類列表 */}
                        <Collapse
                            activeKey={expandedCategories}
                            onChange={setExpandedCategories}
                        >
                            {categories.map(category => (
                                <Panel
                                    key={category.id}
                                    header={
                                        <Space>
                                            <Text strong>{category.name}</Text>
                                            <Tag color="blue">
                                                {(tags[category.id] || []).length} tags
                                            </Tag>
                                            {isAdmin && (
                                                <Space size="small">
                                                    <Button
                                                        type="link"
                                                        size="small"
                                                        icon={<EditOutlined />}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingItem(category);
                                                            form.setFieldsValue(category);
                                                            setCategoryModalVisible(true);
                                                        }}
                                                    />
                                                    <Popconfirm
                                                        title="Are you sure you want to delete this category?"
                                                        onConfirm={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteCategory(category.id);
                                                        }}
                                                        icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
                                                    >
                                                        <Button
                                                            type="link"
                                                            size="small"
                                                            danger
                                                            icon={<DeleteOutlined />}
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                    </Popconfirm>
                                                </Space>
                                            )}
                                        </Space>
                                    }
                                >
                                    {renderTagList(category.id)}
                                </Panel>
                            ))}
                        </Collapse>
                    </Space>
                </div>
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