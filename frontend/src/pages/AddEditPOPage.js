import React, { useState, useEffect } from 'react';
import { 
    Form, 
    Input, 
    Button, 
    Card, 
    DatePicker, 
    Space, 
    message, 
    Row, 
    Col,
    Table,
    InputNumber,
    Typography,
    Select,
    Tag,
    Popconfirm,
    Modal,
    Divider,
    Collapse,
    Breadcrumb
} from 'antd';
import { useNavigate, useParams, Link } from 'react-router-dom';
import moment from 'moment';
import { useAuth } from '../contexts/AuthContext';
import { poService } from '../api/services';
import { PlusOutlined, MenuOutlined, EditOutlined } from '@ant-design/icons';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import styled from 'styled-components';
import { useLocation } from 'react-router-dom';
import { tagService } from '../api/services';

const StyledDatePicker = styled(DatePicker)`
    input {
        cursor: pointer;
    }
`;

const { TextArea } = Input;
const { Title } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

const DroppableCategories = React.memo(({ children }) => {
    const [enabled, setEnabled] = React.useState(false);

    React.useEffect(() => {
        const animation = requestAnimationFrame(() => setEnabled(true));
        return () => {
            cancelAnimationFrame(animation);
            setEnabled(false);
        };
    }, []);

    if (!enabled) {
        return null;
    }

    return (
        <Droppable droppableId="categories" type="CATEGORY">
            {(provided) => (
                <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    style={{ 
                        minHeight: 100,
                        border: '1px solid #f0f0f0',
                        borderRadius: 8,
                        padding: '16px 8px 8px 8px',
                        backgroundColor: '#ffffff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}
                >
                    {children}
                    {provided.placeholder}
                </div>
            )}
        </Droppable>
    );
});

const DraggableCategory = React.memo(({ category, index, categoryTags, handleTagSearch, handleTagSelect, handleRemoveCategory, itemForm }) => {
    return (
        <Draggable draggableId={category.id.toString()} index={index} type="CATEGORY">
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    style={{
                        ...provided.draggableProps.style,
                        marginBottom: 8,
                        background: snapshot.isDragging ? '#fafafa' : 'white',
                        padding: '8px 12px',
                        border: '1px solid #f0f0f0',
                        borderRadius: 4,
                        transition: 'all 0.3s'
                    }}
                >
                    <Row gutter={8} align="middle">
                        <Col flex="24px">
                            <div
                                {...provided.dragHandleProps}
                                style={{
                                    cursor: 'move',
                                    color: '#999',
                                    fontSize: '14px',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <MenuOutlined />
                            </div>
                        </Col>
                        <Col flex="auto">
                            <Row gutter={8} align="middle">
                                <Col flex="120px">
                                    <div style={{ 
                                        fontSize: '14px', 
                                        color: '#666',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}>
                                        <span>{category.name}</span>
                                        <Button 
                                            type="link" 
                                            danger
                                            size="small"
                                            onClick={() => handleRemoveCategory(category.id)}
                                            style={{ padding: '0 4px', minWidth: 'auto' }}
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                </Col>
                                <Col flex="auto">
                                    <Form.Item
                                        name={`tag_${category.id}`}
                                        style={{ marginBottom: 0 }}
                                    >
                                        <Select 
                                            style={{ width: '100%' }} 
                                            placeholder={`Select ${category.name}`}
                                            showSearch
                                            allowClear
                                            size="small"
                                            filterOption={(input, option) => {
                                                if (option.isNew) return true;
                                                return option.children.toLowerCase().includes(input.toLowerCase());
                                            }}
                                            onSearch={(value) => handleTagSearch(category.id, value)}
                                            onSelect={(value) => handleTagSelect(category.id, value)}
                                        >
                                            {(categoryTags[category.id] || []).map(tag => (
                                                <Option 
                                                    key={tag.id} 
                                                    value={tag.id}
                                                    isNew={tag.isNew}
                                                >
                                                    {tag.name}
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Col>
                    </Row>
                </div>
            )}
        </Draggable>
    );
});

const AddEditPOPage = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { user } = useAuth();
    const isAdmin = user?.group_name === 'admin';
    const isEditing = !!id;
    const [form] = Form.useForm();
    const [itemForm] = Form.useForm();
    const location = useLocation();
    
    // State
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState([]);
    const [tags, setTags] = useState({});
    const [items, setItems] = useState([]);
    const [newTagName, setNewTagName] = useState('');
    const [addTagModalVisible, setAddTagModalVisible] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [categoryTags, setCategoryTags] = useState({});
    const [availableCategories, setAvailableCategories] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [editingItem, setEditingItem] = useState(null);
    const [editModalVisible, setEditModalVisible] = useState(false);

    // 從 localStorage 加載保存的分類
    const loadSavedCategories = () => {
        try {
            const savedCategories = localStorage.getItem('savedPOCategories');
            if (savedCategories) {
                const savedData = JSON.parse(savedCategories);
                return savedData.categoryIds;
            }
        } catch (error) {
            console.error('Error loading saved categories:', error);
        }
        return [];
    };

    // 保存分類選擇到 localStorage
    const saveCategories = () => {
        try {
            const savedData = {
                categoryIds: selectedCategories.map(cat => cat.id),
                order: selectedCategories.map(cat => ({
                    id: cat.id,
                    name: cat.name
                }))
            };
            localStorage.setItem('savedPOCategories', JSON.stringify(savedData));
            message.success('Categories selection and order saved successfully');
        } catch (error) {
            console.error('Error saving categories:', error);
            message.error('Failed to save categories selection');
        }
    };

    // 保存表單數據到 localStorage
    const saveFormDataToStorage = (formValues = null, itemsData = null) => {
        try {
            const values = formValues || form.getFieldsValue();
            const tempData = {
                ...values,
                date: values.date ? values.date.format('YYYY-MM-DD') : undefined,
                items: itemsData || items
            };
            localStorage.setItem('tempPOData', JSON.stringify(tempData));
            
            // 同時保存 items 到單獨的存儲
            if (itemsData || items) {
                localStorage.setItem('tempItemList', JSON.stringify(itemsData || items));
            }
        } catch (error) {
            console.error('Error saving form data:', error);
        }
    };

    // 加載暫存的數據
    useEffect(() => {
        if (!isEditing) {
            try {
                // 檢查是否有導入的數據
                const { state } = location;
                if (state?.importedItems) {
                    setItems(state.importedItems);
                    return;
                }

                // 如果沒有導入的數據，嘗試從 localStorage 加載
                const savedItems = localStorage.getItem('tempItemList');
                if (savedItems) {
                    const parsedItems = JSON.parse(savedItems);
                    setItems(parsedItems);
                }

                const tempData = localStorage.getItem('tempPOData');
                if (tempData) {
                    const data = JSON.parse(tempData);
                    form.setFieldsValue({
                        poNumber: data.poNumber,
                        date: data.date ? moment(data.date) : undefined,
                        supplier: data.supplier,
                        note: data.note
                    });
                }
            } catch (error) {
                console.error('Error loading saved data:', error);
            }
        }
    }, [isEditing, form, location]);

    // 初始化數據
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                // 獲取所有可用分類
                const categoriesResponse = await tagService.getCategories();
                if (!categoriesResponse?.success || !Array.isArray(categoriesResponse.categories)) {
                    console.error('Invalid categories response:', categoriesResponse);
                    message.error('Failed to load categories');
                    return;
                }

                const categories = categoriesResponse.categories;
                setAvailableCategories(categories);
                
                try {
                    // 加載保存的分類選擇和順序
                    const savedDataStr = localStorage.getItem('savedPOCategories');
                    if (!savedDataStr) return;

                    const savedData = JSON.parse(savedDataStr);
                    if (!savedData || !Array.isArray(savedData.categoryIds) || !Array.isArray(savedData.order)) {
                        console.warn('Invalid saved categories data:', savedData);
                        return;
                    }

                    const { categoryIds: savedCategoryIds, order: savedOrder } = savedData;

                    // 如果有保存的分類順序，使用它
                    if (savedCategoryIds.length > 0 && savedOrder.length > 0) {
                        const orderedCategories = savedOrder
                            .map(saved => categories.find(cat => cat && cat.id === saved.id))
                            .filter(Boolean);

                        if (orderedCategories.length > 0) {
                            setSelectedCategories(orderedCategories);
                            // Load tags sequentially to avoid race conditions
                            for (const category of orderedCategories) {
                                if (category && category.id) {
                                    await handleLoadCategoryTags(category.id);
                                }
                            }
                        }
                    }
                } catch (storageError) {
                    console.error('Error processing saved categories:', storageError);
                }

                // 如果是新建模式，獲取新的 PO Number
                if (!isEditing) {
                    const response = await poService.getNewPONumber();
                    if (response?.success) {
                        form.setFieldsValue({
                            poNumber: response.poNumber,
                            date: moment()
                        });
                    }
                }
            } catch (error) {
                console.error('Error fetching initial data:', error);
                message.error('Failed to load data');
            }
        };

        fetchInitialData();
    }, [isEditing, id, form]);

    // 處理添加分類
    const handleAddCategory = (categoryId) => {
        const category = availableCategories.find(c => c.id === categoryId);
        if (category && !selectedCategories.find(c => c.id === categoryId)) {
            setSelectedCategories([...selectedCategories, category]);
            // 加載該分類的標籤
            handleLoadCategoryTags(categoryId);
        }
    };

    // 處理移除分類
    const handleRemoveCategory = (categoryId) => {
        setSelectedCategories(selectedCategories.filter(c => c.id !== categoryId));
        // 清除該分類的表單值
        itemForm.setFieldValue(`tag_${categoryId}`, undefined);
        // 清除該分類的標籤數據
        setCategoryTags(prev => {
            const newTags = { ...prev };
            delete newTags[categoryId];
            return newTags;
        });
    };

    // 加載分類的標籤
    const handleLoadCategoryTags = async (categoryId) => {
        try {
            const response = await poService.getTagsByCategory(categoryId);
            if (response?.success) {
                const tags = response.tags || [];
                const activeTags = tags.filter(tag => tag.is_active);
                setCategoryTags(prev => ({
                    ...prev,
                    [categoryId]: activeTags
                }));
            } else {
                throw new Error(response?.error || 'Failed to load tags');
            }
        } catch (error) {
            console.error('Error loading tags:', error);
            message.error('Failed to load tags');
        }
    };

    // 處理添加新標籤
    const handleAddNewTag = async (categoryId, tagName) => {
        try {
            const response = await poService.createTag({
                name: tagName,
                category_id: categoryId,
                is_active: true
            });

            if (response?.data?.success) {
                message.success('Tag added successfully');
                // 重新加載該分類的標籤
                await handleLoadCategoryTags(categoryId);
                // 找到新添加的標籤
                const newTag = (categoryTags[categoryId] || []).find(tag => tag.name === tagName);
                if (newTag) {
                    itemForm.setFieldValue(`tag_${categoryId}`, newTag.id);
                }
            }
        } catch (error) {
            console.error('Error adding tag:', error);
            message.error('Failed to add tag');
        }
    };

    // 處理標籤搜索
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
                    await handleAddNewTag(categoryId, tagName);
                }
            }
        } catch (error) {
            console.error('Error selecting tag:', error);
            message.error('Failed to select tag');
        }
    };

    // 處理添加項目
    const handleAddItem = () => {
        itemForm.validateFields().then(values => {
            if (!values.serialnumber) {
                message.error('Serial number is required');
                return;
            }

            // 收集所有分類的標籤數據
            const categories = [];
            selectedCategories.forEach(category => {
                const tagId = values[`tag_${category.id}`];
                if (tagId) {
                    categories.push({
                        category_id: category.id,
                        tag_id: tagId
                    });
                }
            });

            const newItem = {
                id: Date.now(),
                serialnumber: values.serialnumber.trim(),
                cost: Number(values.cost),
                so: values.so ? values.so.trim() : '',
                note: values.note ? values.note.trim() : '',
                categories: categories  // 保存分類和標籤的關係
            };

            const newItems = [...items, newItem];
            setItems(newItems);
            saveFormDataToStorage(null, newItems);  // 保存更新後的數據
            itemForm.resetFields();
        }).catch(error => {
            message.error('Form validation failed');
        });
    };

    // 處理刪除項目
    const handleDeleteItem = (itemId) => {
        const newItems = items.filter(item => item.id !== itemId);
        setItems(newItems);
        saveFormDataToStorage(null, newItems);  // 保存更新後的數據
    };

    // Handle drag end
    const handleDragEnd = (result) => {
        if (!result.destination) return;

        const items = Array.from(selectedCategories);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        setSelectedCategories(items);
    };

    // 獲取表格列定義
    const getColumns = () => {
        const columns = [
            {
                title: 'Serial Number',
                dataIndex: 'serialnumber',
                key: 'serialnumber',
                width: 150,
                fixed: 'left'
            }
        ];

        // 添加分類列
        selectedCategories.forEach(category => {
            columns.push({
                title: category.name,
                key: `category_${category.id}`,
                width: 120,
                render: (_, record) => {
                    const categoryData = record.categories?.find(cat => 
                        cat.category_id === category.id
                    );
                    if (!categoryData) return '-';
                    const tag = categoryTags[category.id]?.find(t => t.id === categoryData.tag_id);
                    return tag ? <Tag key={`${record.id}_${category.id}`} color="blue">{tag.name}</Tag> : '-';
                }
            });
        });

        // 添加其他基本列
        columns.push(
            {
                title: 'Cost',
                dataIndex: 'cost',
                key: 'cost',
                width: 100,
                render: (text) => `$${Number(text).toFixed(2)}`
            },
            {
                title: 'SO',
                dataIndex: 'so',
                key: 'so',
                width: 100
            },
            {
                title: 'Note',
                dataIndex: 'note',
                key: 'note',
                width: 150
            },
            {
                title: 'Actions',
                key: 'actions',
                fixed: 'right',
                width: 100,
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
                            onConfirm={() => handleDeleteItem(record.id)}
                            okText="Yes"
                            cancelText="No"
                        >
                            <Button type="link" danger>Delete</Button>
                        </Popconfirm>
                    </Space>
                )
            }
        );

        return columns;
    };

    // 處理編輯項目
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
        itemForm.setFieldsValue(formValues);
        setEditModalVisible(true);
    };

    // 處理編輯保存
    const handleEditSave = async () => {
        try {
            const values = await itemForm.validateFields();
            
            // 處理分類標籤
            const categories = selectedCategories
                .map(category => {
                    const tagId = values[`category_${category.id}`];
                    if (tagId) {
                        return {
                            category_id: category.id,
                            tag_id: tagId
                        };
                    }
                    return null;
                })
                .filter(Boolean);

            // 更新項目數據
            const updatedItem = {
                ...editingItem,
                serialnumber: values.serialnumber,
                cost: Number(values.cost),
                so: values.so || '',
                note: values.note || '',
                categories
            };

            // 更新列表
            setItems(prevItems => 
                prevItems.map(item => 
                    item.id === editingItem.id ? updatedItem : item
                )
            );

            message.success('Item updated successfully');
            setEditModalVisible(false);
            itemForm.resetFields();
            setEditingItem(null);
        } catch (error) {
            console.error('Error updating item:', error);
            message.error('Failed to update item');
        }
    };

    // 處理表單提交
    const handleSubmit = async () => {
        try {
            const values = form.getFieldsValue();
            
            if (items.length === 0) {
                throw new Error('Please add at least one item');
            }

            setLoading(true);
            
            // 格式化數據以匹配後端期望的格式
            const formData = {
                order: {
                    po_number: values.poNumber,
                    order_date: values.date.format('YYYY-MM-DD'),
                    supplier: values.supplier?.trim() || 'none',
                    notes: values.note?.trim() || '',
                    status: 'verified'
                },
                items: items.map(item => ({
                    serialnumber: item.serialnumber,
                    cost: Number(item.cost),
                    so: item.so || '',
                    note: item.note || '',
                    categories: item.categories || []
                }))
            };

            if (isEditing) {
                await poService.updatePO(id, formData);
                message.success('Purchase order updated successfully');
            } else {
                await poService.createPO(formData);
                message.success('Purchase order created successfully');
            }

            // Clear temporary data
            localStorage.removeItem('tempPOData');
            localStorage.removeItem('tempItemList');

            // Navigate back to PO list with Inbound PO tab active
            navigate('/inbound/purchase-order', { 
                state: { activeTab: 'inbound-po' }
            });
        } catch (error) {
            if (error.response?.data?.errors) {
                message.error(error.response.data.errors.join('\n'));
            } else {
                message.error(error.message || 'Failed to submit purchase order');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <div style={{ padding: 24 }}>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Breadcrumb
                        items={[
                            {
                                title: <Link to="/inbound/purchase-order">Purchase Orders</Link>,
                            },
                            {
                                title: isEditing ? 'Edit Purchase Order' : 'Create Purchase Order',
                            },
                        ]}
                        style={{ marginBottom: 16 }}
                    />
                    
                    {/* 第一欄 - PO基本信息 */}
                    <Card title={isEditing ? 'Edit Purchase Order' : 'Create Purchase Order'}>
                        <Form
                            form={form}
                            layout="horizontal"
                            labelCol={{ span: 4 }}
                            wrapperCol={{ span: 18 }}
                            onValuesChange={(_, allValues) => {
                                saveFormDataToStorage(allValues);
                            }}
                        >
                            <Row gutter={24}>
                                <Col span={12}>
                                    <Form.Item
                                        name="poNumber"
                                        label="PO Number"
                                    >
                                        <Input disabled />
                                    </Form.Item>

                                    <Form.Item
                                        name="date"
                                        label="PO Date"
                                    >
                                        <DatePicker 
                                            style={{ width: '100%' }}
                                            format="YYYY-MM-DD"
                                            disabled
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        name="supplier"
                                        label="Supplier"
                                    >
                                        <Input placeholder="Enter supplier name (optional)" />
                                    </Form.Item>

                                    <Form.Item
                                        name="note"
                                        label="Note"
                                    >
                                        <TextArea rows={2} placeholder="Enter note (optional)" />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Form>
                    </Card>

                    {/* Add Item Collapse Panel */}
                    <Collapse defaultActiveKey={[]}>
                        <Panel 
                            header="Add New Item" 
                            key="1"
                            extra={
                                <Space size="small">
                                    <Select
                                        style={{ width: 150 }}
                                        placeholder="+ Add Category"
                                        onChange={handleAddCategory}
                                        value={undefined}
                                        size="small"
                                        dropdownMatchSelectWidth={false}
                                        onClick={e => e.stopPropagation()}
                                    >
                                        {availableCategories
                                            .filter(cat => !selectedCategories.find(sc => sc.id === cat.id))
                                            .map(category => (
                                                <Option key={category.id} value={category.id}>
                                                    {category.name}
                                                </Option>
                                            ))}
                                    </Select>
                                    <Button
                                        type="primary"
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            saveCategories();
                                        }}
                                        style={{ padding: '0 8px', height: '24px' }}
                                    >
                                        Save Categories
                                    </Button>
                                </Space>
                            }
                        >
                            <Form
                                form={itemForm}
                                layout="vertical"
                            >
                                <Row gutter={24}>
                                    <Col span={8}>
                                        <Form.Item
                                            name="serialnumber"
                                            label="Serial Number"
                                            rules={[{ required: true, message: 'Please input serial number' }]}
                                        >
                                            <Input placeholder="Enter serial number" />
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
                                    </Col>
                                    <Col span={8}>
                                        <Form.Item
                                            name="so"
                                            label="SO"
                                        >
                                            <Input placeholder="Enter SO" />
                                        </Form.Item>
                                        <Form.Item
                                            name="note"
                                            label="Note"
                                        >
                                            <Input.TextArea rows={1} placeholder="Enter note" />
                                        </Form.Item>
                                    </Col>
                                    <Col span={8}>
                                        <div style={{ 
                                            backgroundColor: '#fafafa',
                                            padding: '8px',
                                            borderRadius: '4px',
                                            marginBottom: '16px'
                                        }}>
                                            <DroppableCategories>
                                                {selectedCategories.map((category, index) => (
                                                    <DraggableCategory
                                                        key={category.id}
                                                        category={category}
                                                        index={index}
                                                        categoryTags={categoryTags}
                                                        handleTagSearch={handleTagSearch}
                                                        handleTagSelect={handleTagSelect}
                                                        handleRemoveCategory={handleRemoveCategory}
                                                        itemForm={itemForm}
                                                    />
                                                ))}
                                            </DroppableCategories>
                                        </div>
                                    </Col>
                                </Row>
                                <Row>
                                    <Col span={24} style={{ textAlign: 'right' }}>
                                        <Button type="primary" onClick={handleAddItem}>
                                            Add Item
                                        </Button>
                                    </Col>
                                </Row>
                            </Form>
                        </Panel>
                    </Collapse>

                    {/* 第三欄 - 項目列表 */}
                    <Card title="Item List">
                        <Table
                            columns={getColumns()}
                            dataSource={items}
                            rowKey="id"
                            pagination={false}
                            summary={pageData => {
                                const total = pageData.reduce((sum, item) => sum + Number(item.cost), 0);
                                return (
                                    <Table.Summary.Row>
                                        <Table.Summary.Cell index={0} colSpan={selectedCategories.length + 1}>
                                            <Space>
                                                <strong>Total Items: {pageData.length}</strong>
                                                <Divider type="vertical" />
                                                <strong>Total Cost</strong>
                                            </Space>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={selectedCategories.length + 1}>
                                            <strong>${total.toFixed(2)}</strong>
                                        </Table.Summary.Cell>
                                        <Table.Summary.Cell index={selectedCategories.length + 2} colSpan={3} />
                                    </Table.Summary.Row>
                                );
                            }}
                        />
                    </Card>

                    <div style={{ textAlign: 'right' }}>
                        <Space>
                            <Button onClick={() => {
                                localStorage.removeItem('tempPOData');
                                localStorage.removeItem('tempItemList');
                                navigate('/inbound/purchase-order');
                            }}>
                                Cancel
                            </Button>
                            <Button
                                type="primary"
                                onClick={handleSubmit}
                                loading={loading}
                                disabled={items.length === 0}
                            >
                                {isEditing ? 'Update PO' : 'Create PO'}
                            </Button>
                        </Space>
                    </div>

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
                        onCancel={() => {
                            setEditModalVisible(false);
                            itemForm.resetFields();
                            setEditingItem(null);
                        }}
                        width={800}
                        maskClosable={false}
                        destroyOnClose
                    >
                        <Form
                            form={itemForm}
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
                                        {selectedCategories.map(category => (
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
                </Space>
            </div>
        </DragDropContext>
    );
};

export default AddEditPOPage; 