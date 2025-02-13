import React, { useState, useEffect } from 'react';
import { 
    Card, 
    Descriptions, 
    Button, 
    Space, 
    message,
    Table,
    Spin,
    Tabs,
    Tag,
    Typography,
    Statistic,
    Modal,
    Form,
    Input,
    InputNumber,
    Select,
    Row,
    Col,
    Popconfirm
} from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import moment from 'moment';
import poService from '../services/poService';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';

const { TabPane } = Tabs;
const { Title } = Typography;
const { Option } = Select;

const PODetailPage = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [poData, setPOData] = useState(null);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [editForm] = Form.useForm();
    const [categoryTags, setCategoryTags] = useState({});
    const [isEditMode, setIsEditMode] = useState(false);

    // 加載分類的標籤
    const loadCategoryTags = async (categoryId) => {
        try {
            const response = await poService.getTagsByCategory(categoryId);
            if (response?.data?.tags) {
                setCategoryTags(prev => ({
                    ...prev,
                    [categoryId]: response.data.tags
                }));
            }
        } catch (error) {
            console.error('Error loading tags:', error);
        }
    };

    // 加載所有分類的標籤
    const loadAllCategoryTags = async () => {
        if (poData?.categories) {
            for (const category of poData.categories) {
                await loadCategoryTags(category.id);
            }
        }
    };

    useEffect(() => {
        const fetchPOData = async () => {
            try {
                setLoading(true);
                const response = await poService.getPOById(id);
                if (response?.data?.success) {
                    setPOData(response.data.data);
                    console.log('PO Data:', response.data.data);  // 添加日誌
                }
            } catch (error) {
                console.error('Error fetching PO data:', error);
                message.error('Failed to load PO data');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchPOData();
        }
    }, [id]);

    useEffect(() => {
        if (poData?.categories) {
            loadAllCategoryTags();
        }
    }, [poData?.categories]);

    const handleEdit = () => {
        setIsEditMode(true);
    };

    const handleCancelEdit = () => {
        setIsEditMode(false);
        setEditModalVisible(false);
    };

    const handleSaveAll = async () => {
        try {
            setLoading(true);
            
            // 準備更新數據
            const updateData = {
                order: {
                    ...poData.order,
                    total_amount: poData.items.reduce((sum, item) => sum + Number(item.cost), 0)
                },
                items: poData.items
            };

            // 調用 API 更新數據
            await poService.updatePO(id, updateData);
            
            message.success('Changes saved successfully');
            setIsEditMode(false);
        } catch (error) {
            console.error('Error saving changes:', error);
            message.error('Failed to save changes');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        if (!status) return 'default';  // Handle undefined or null status
        
        switch (status.toLowerCase()) {
            case 'draft':
                return 'default';
            case 'pending':
                return 'processing';
            case 'completed':
                return 'success';
            case 'cancelled':
                return 'error';
            default:
                return 'default';
        }
    };

    // 處理編輯按鈕點擊
    const handleEditItem = (record) => {
        setEditingItem(record);
        // 設置表單初始值
        const formValues = {
            serialnumber: record.serialnumber,
            cost: record.cost,
            so: record.so || '',
            note: record.note || '',
        };
        // 設置分類標籤的初始值
        record.categories?.forEach(cat => {
            formValues[`category_${cat.category_id}`] = cat.tag_id;
        });
        editForm.setFieldsValue(formValues);
        setEditModalVisible(true);
    };

    // 處理對話框關閉
    const handleModalClose = () => {
        setEditModalVisible(false);
        editForm.resetFields();
    };

    // 處理標籤搜索和創建
    const handleTagSearch = (categoryId, value) => {
        if (!value) return;
        // 檢查是否已存在相同名稱的標籤
        const exists = categoryTags[categoryId]?.some(
            tag => tag.name.toLowerCase() === value.toLowerCase()
        );
        if (!exists) {
            // 顯示添加選項
            setCategoryTags(prev => ({
                ...prev,
                [categoryId]: [
                    ...(prev[categoryId] || []),
                    { id: `new-${value}`, name: `Add "${value}"`, isNew: true, value }
                ]
            }));
        }
    };

    // 處理標籤選擇
    const handleTagSelect = async (categoryId, value) => {
        try {
            // 檢查是否選擇了添加新標籤的選項
            if (typeof value === 'string' && value.startsWith('new-')) {
                const tagName = categoryTags[categoryId].find(t => t.id === value)?.value;
                if (tagName) {
                    // 創建新標籤
                    const response = await poService.createTag({
                        name: tagName,
                        category_id: categoryId
                    });

                    if (response?.data?.success) {
                        message.success('Tag added successfully');
                        // 重新加載該分類的標籤
                        await loadCategoryTags(categoryId);
                        // 使用新創建的標籤ID
                        editForm.setFieldValue(`category_${categoryId}`, response.data.tag.id);
                    }
                }
            }
        } catch (error) {
            console.error('Error handling tag selection:', error);
            message.error('Failed to create new tag');
        }
    };

    // 處理編輯保存
    const handleEditSave = async () => {
        try {
            const values = await editForm.validateFields();
            
            // 處理分類標籤
            const categories = Object.entries(values)
                .filter(([key, value]) => key.startsWith('category_') && value)
                .map(([key, value]) => ({
                    category_id: parseInt(key.split('_')[1]),
                    tag_id: value
                }));

            // 更新項目數據
            const updatedItem = {
                ...editingItem,
                serialnumber: values.serialnumber,
                cost: values.cost,
                so: values.so,
                note: values.note,
                categories
            };

            // 更新 PO 數據
            const updatedItems = poData.items.map(item => 
                item.id === editingItem.id ? updatedItem : item
            );

            // 調用 API 更新數據
            await poService.updatePOItem(id, editingItem.id, updatedItem);
            
            // 更新本地數據
            setPOData(prev => ({
                ...prev,
                items: updatedItems
            }));

            message.success('Item updated successfully');
            setEditModalVisible(false);
        } catch (error) {
            console.error('Error updating item:', error);
            message.error('Failed to update item');
        }
    };

    // 處理刪除項目
    const handleDeleteItem = async (record) => {
        try {
            // 更新本地數據
            const updatedItems = poData.items.filter(item => item.id !== record.id);
            
            // 更新 PO 數據
            setPOData(prev => ({
                ...prev,
                items: updatedItems
            }));

            // 更新總金額
            const newTotalAmount = updatedItems.reduce((sum, item) => sum + Number(item.cost), 0);
            setPOData(prev => ({
                ...prev,
                order: {
                    ...prev.order,
                    total_amount: newTotalAmount
                }
            }));

            message.success('Item deleted successfully');
        } catch (error) {
            console.error('Error deleting item:', error);
            message.error('Failed to delete item');
        }
    };

    const columns = [
        {
            title: 'Serial Number',
            dataIndex: 'serialnumber',
            key: 'serialnumber',
            width: 150,
            fixed: 'left'
        },
        // Add all category columns
        ...(poData?.categories || []).map(category => ({
            title: category.name,
            key: `category_${category.id}`,
            width: 120,
            render: (_, record) => {
                const categoryData = record.categories?.find(cat => 
                    cat && cat.category_id === category.id
                );
                return categoryData ? (
                    <Tag color="blue">{categoryData.tag_name}</Tag>
                ) : '-';
            }
        })),
        {
            title: 'Cost',
            dataIndex: 'cost',
            key: 'cost',
            width: 100,
            fixed: 'right',
            render: (cost) => `$ ${Number(cost).toFixed(2)}`
        },
        {
            title: 'SO',
            dataIndex: 'so',
            key: 'so',
            width: 100,
            fixed: 'right'
        },
        {
            title: 'Note',
            dataIndex: 'note',
            key: 'note',
            width: 150,
            fixed: 'right'
        },
        // 只在編輯模式下顯示 Actions 列
        ...(isEditMode ? [{
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 150,
            render: (_, record) => (
                <Space>
                    <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEditItem(record)}
                    >
                        Edit
                    </Button>
                    <Popconfirm
                        title="Are you sure to delete this item?"
                        onConfirm={() => handleDeleteItem(record)}
                        okText="Yes"
                        cancelText="No"
                    >
                        <Button type="link" danger icon={<DeleteOutlined />}>
                            Delete
                        </Button>
                    </Popconfirm>
                </Space>
            )
        }] : [])
    ];

    if (loading) {
        return (
            <div style={{ padding: 24, textAlign: 'center' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div style={{ padding: 24 }}>
            <Card 
                title={
                    <Space size="middle">
                        <span>Purchase Order Details</span>
                        <Tag color={getStatusColor(poData?.order?.status)}>
                            {poData?.order?.status?.toUpperCase()}
                        </Tag>
                    </Space>
                }
                extra={
                    <Space>
                        {!isEditMode ? (
                            <Button
                                type="primary"
                                icon={<EditOutlined />}
                                onClick={handleEdit}
                            >
                                Edit
                            </Button>
                        ) : (
                            <>
                                <Button
                                    type="primary"
                                    onClick={handleSaveAll}
                                >
                                    Save
                                </Button>
                                <Button onClick={handleCancelEdit}>
                                    Cancel
                                </Button>
                            </>
                        )}
                        <Button onClick={() => navigate('/inbound/purchase-order', { 
                            replace: true,
                            state: { activeTab: 'inbound-po' }
                        })}>
                            Back
                        </Button>
                    </Space>
                }
            >
                {poData?.order && (
                    <>
                        <Descriptions bordered column={2}>
                            <Descriptions.Item label="PO Number">
                                {poData.order.po_number}
                            </Descriptions.Item>
                            <Descriptions.Item label="Date">
                                {moment(poData.order.order_date).format('YYYY-MM-DD')}
                            </Descriptions.Item>
                            <Descriptions.Item label="Supplier">
                                {poData.order.supplier}
                            </Descriptions.Item>
                            <Descriptions.Item label="Total Amount">
                                <Statistic 
                                    value={poData.order.total_amount} 
                                    precision={2} 
                                    prefix="$"
                                    valueStyle={{ color: '#cf1322' }}
                                />
                            </Descriptions.Item>
                            <Descriptions.Item label="Note">
                                {poData.order.notes || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Total Items">
                                {poData.items?.length || 0}
                            </Descriptions.Item>
                        </Descriptions>

                        <div style={{ marginTop: 24 }}>
                            <Title level={4}>Order Details</Title>
                            <Table
                                dataSource={poData.items}
                                columns={columns}
                                pagination={false}
                                rowKey="id"
                                scroll={{ x: 'max-content' }}
                                summary={pageData => {
                                    const total = pageData.reduce(
                                        (sum, item) => sum + Number(item.cost),
                                        0
                                    );
                                    const categoryCount = poData?.categories?.length || 0;
                                    return (
                                        <Table.Summary.Row>
                                            <Table.Summary.Cell index={0} colSpan={categoryCount + 1}>
                                                <strong>Total</strong>
                                            </Table.Summary.Cell>
                                            <Table.Summary.Cell index={categoryCount + 1}>
                                                <strong>$ {total.toFixed(2)}</strong>
                                            </Table.Summary.Cell>
                                            <Table.Summary.Cell index={categoryCount + 2} colSpan={2} />
                                        </Table.Summary.Row>
                                    );
                                }}
                            />
                        </div>
                    </>
                )}
            </Card>

            {/* 編輯項目的模態框 */}
            <Modal
                title={
                    <Space>
                        <EditOutlined />
                        <span>Edit Item</span>
                    </Space>
                }
                open={editModalVisible}
                onOk={handleEditSave}
                onCancel={handleModalClose}
                width={800}
                maskClosable={false}
                destroyOnClose
            >
                <Form
                    form={editForm}
                    layout="vertical"
                >
                    <Row gutter={24}>
                        <Col span={12}>
                            <Form.Item
                                name="serialnumber"
                                label="Serial Number"
                                rules={[{ required: true, message: 'Please input serial number' }]}
                            >
                                <Input />
                            </Form.Item>

                            <Form.Item
                                name="cost"
                                label="Cost"
                                rules={[{ required: true, message: 'Please input cost' }]}
                            >
                                <InputNumber
                                    style={{ width: '100%' }}
                                    min={0}
                                    precision={2}
                                    prefix="$"
                                />
                            </Form.Item>

                            <Form.Item
                                name="so"
                                label="SO"
                            >
                                <Input />
                            </Form.Item>

                            <Form.Item
                                name="note"
                                label="Note"
                            >
                                <Input.TextArea rows={2} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Card title="Categories" bordered={false}>
                                {poData?.categories?.map(category => (
                                    <Form.Item
                                        key={category.id}
                                        name={`category_${category.id}`}
                                        label={category.name}
                                    >
                                        <Select
                                            allowClear
                                            showSearch
                                            placeholder={`Select ${category.name}`}
                                            filterOption={false}
                                            onSearch={(value) => handleTagSearch(category.id, value)}
                                            onSelect={(value) => handleTagSelect(category.id, value)}
                                        >
                                            {categoryTags[category.id]?.map(tag => (
                                                <Option 
                                                    key={tag.id} 
                                                    value={tag.id}
                                                    className={tag.isNew ? 'new-tag-option' : ''}
                                                >
                                                    {tag.name}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                ))}
                            </Card>
                        </Col>
                    </Row>
                </Form>
            </Modal>
        </div>
    );
};

export default PODetailPage; 