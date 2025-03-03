import React, { useState, useEffect } from 'react';
import {
    Table,
    Button,
    Modal,
    Form,
    Input,
    Select,
    message,
    Space,
    Tag,
    Alert,
    Card,
    Divider,
    Typography,
    ColorPicker,
    Collapse,
    Input as AntInput
} from 'antd';
import {
    EditOutlined,
    PlusOutlined,
    DeleteOutlined,
    TagOutlined,
    SearchOutlined
} from '@ant-design/icons';
import { tagService } from '../../api';

const { Title } = Typography;
const { Option } = Select;
const { Panel } = Collapse;
const { Search } = AntInput;

const TagManagement = () => {
    const [tags, setTags] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingTag, setEditingTag] = useState(null);
    const [form] = Form.useForm();
    const [searchText, setSearchText] = useState('');
    const [expandedCategories, setExpandedCategories] = useState([]);

    // 獲取標籤和分類
    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // 獲取分類
            const categoriesResponse = await tagService.getCategories();
            if (!categoriesResponse?.success) {
                throw new Error(categoriesResponse?.error || 'Failed to fetch categories');
            }
            setCategories(categoriesResponse.categories);

            // 獲取標籤
            const tagsResponse = await tagService.getTags();
            if (!tagsResponse?.success) {
                throw new Error(tagsResponse?.error || 'Failed to fetch tags');
            }
            setTags(tagsResponse.tags);
        } catch (error) {
            console.error('Error fetching data:', error);
            setError(error.message);
            message.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAdd = () => {
        setEditingTag(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (tag) => {
        setEditingTag(tag);
        form.setFieldsValue({
            name: tag.name,
            category_id: tag.category_id,
            color: tag.color,
            description: tag.description
        });
        setIsModalVisible(true);
    };

    const handleDelete = async (tagId) => {
        try {
            setLoading(true);
            const response = await tagService.deleteTag(tagId);
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to delete tag');
            }
            message.success('Tag deleted successfully');
            await fetchData();
        } catch (error) {
            console.error('Error deleting tag:', error);
            message.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (values) => {
        try {
            setLoading(true);
            setError(null);

            const tagData = {
                name: values.name.trim(),
                category_id: values.category_id,
                color: values.color || '#1890ff',
                description: values.description?.trim()
            };

            let response;
            if (editingTag) {
                response = await tagService.updateTag(editingTag.id, tagData);
            } else {
                response = await tagService.createTag(tagData);
            }

            if (!response?.success) {
                throw new Error(response?.error || `Failed to ${editingTag ? 'update' : 'create'} tag`);
            }

            message.success(`Tag ${editingTag ? 'updated' : 'created'} successfully`);
            setIsModalVisible(false);
            form.resetFields();
            await fetchData();
        } catch (error) {
            console.error('Error saving tag:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    // 搜索功能
    const handleSearch = (value) => {
        setSearchText(value.toLowerCase());
    };

    // 過濾標籤
    const filterTags = (categoryId) => {
        return tags.filter(tag => {
            const matchesCategory = tag.category_id === categoryId;
            const matchesSearch = searchText ? (
                tag.name.toLowerCase().includes(searchText) ||
                tag.description?.toLowerCase().includes(searchText)
            ) : true;
            return matchesCategory && matchesSearch;
        });
    };

    // 展開/收縮所有分類
    const handleExpandAll = () => {
        if (expandedCategories.length === categories.length) {
            setExpandedCategories([]);
        } else {
            setExpandedCategories(categories.map(cat => cat.id));
        }
    };

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={2}>Tag Management</Title>
                <Space>
                    <Search
                        placeholder="Search tags..."
                        allowClear
                        onSearch={handleSearch}
                        onChange={e => handleSearch(e.target.value)}
                        style={{ width: 200 }}
                    />
                    <Button
                        type="default"
                        onClick={handleExpandAll}
                    >
                        {expandedCategories.length === categories.length ? 'Collapse All' : 'Expand All'}
                    </Button>
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={handleAdd}
                        disabled={loading}
                    >
                        Add Tag
                    </Button>
                </Space>
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

            <Collapse
                activeKey={expandedCategories}
                onChange={setExpandedCategories}
            >
                {categories.map(category => {
                    const categoryTags = filterTags(category.id);
                    if (searchText && categoryTags.length === 0) {
                        return null;
                    }
                    return (
                        <Panel
                            key={category.id}
                            header={
                                <Space>
                                    <span>{category.name}</span>
                                    <Tag color="blue">{categoryTags.length} tags</Tag>
                                </Space>
                            }
                        >
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {categoryTags.map(tag => (
                                    <Card
                                        key={tag.id}
                                        size="small"
                                        style={{ width: 250, marginBottom: 8 }}
                                        actions={[
                                            <Button
                                                type="text"
                                                icon={<EditOutlined />}
                                                onClick={() => handleEdit(tag)}
                                            />,
                                            <Button
                                                type="text"
                                                danger
                                                icon={<DeleteOutlined />}
                                                onClick={() => handleDelete(tag.id)}
                                            />
                                        ]}
                                    >
                                        <Card.Meta
                                            avatar={
                                                <div
                                                    style={{
                                                        width: 16,
                                                        height: 16,
                                                        backgroundColor: tag.color || '#1890ff',
                                                        borderRadius: 4
                                                    }}
                                                />
                                            }
                                            title={tag.name}
                                            description={tag.description}
                                        />
                                    </Card>
                                ))}
                            </div>
                        </Panel>
                    );
                })}
            </Collapse>

            <Modal
                title={`${editingTag ? 'Edit' : 'Add'} Tag`}
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
                        label="Tag Name"
                        rules={[
                            { required: true, message: 'Please enter tag name' },
                            { min: 2, message: 'Name must be at least 2 characters' }
                        ]}
                    >
                        <Input
                            prefix={<TagOutlined />}
                            placeholder="Enter tag name"
                        />
                    </Form.Item>

                    <Form.Item
                        name="category_id"
                        label="Category"
                        rules={[{ required: true, message: 'Please select a category' }]}
                    >
                        <Select placeholder="Select category">
                            {categories.map(category => (
                                <Option key={category.id} value={category.id}>
                                    {category.name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="color"
                        label="Color"
                    >
                        <ColorPicker />
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="Description"
                    >
                        <Input.TextArea
                            placeholder="Enter description"
                            rows={4}
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default TagManagement; 