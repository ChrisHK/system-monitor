import React, { useState, useEffect, useCallback } from 'react';
import {
    Card,
    Table,
    Input,
    Space,
    Tag,
    Select,
    Typography,
    Statistic,
    Row,
    Col,
    Descriptions,
    message
} from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import moment from 'moment';
import poService from '../services/poService';
import { debounce } from 'lodash';

const { Search } = Input;
const { Option } = Select;
const { Title } = Typography;

const InboundItemsPage = () => {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [searchText, setSearchText] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0
    });

    // 獲取所有分類
    const fetchCategories = async () => {
        try {
            const response = await poService.getCategories();
            if (response?.data?.categories) {
                setCategories(response.data.categories);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
            message.error('Failed to load categories');
        }
    };

    // 獲取所有 PO items
    const fetchItems = async (params = {}) => {
        try {
            setLoading(true);
            const response = await poService.getAllPOItems({
                search: searchText,
                categoryId: selectedCategory,
                page: params.current || pagination.current,
                pageSize: params.pageSize || pagination.pageSize
            });

            if (response?.data?.success) {
                setItems(response.data.items);
                setPagination({
                    ...pagination,
                    current: params.current || pagination.current,
                    pageSize: params.pageSize || pagination.pageSize,
                    total: response.data.total || 0
                });
                setLastUpdated(new Date());
            }
        } catch (error) {
            console.error('Error fetching items:', error);
            message.error('Failed to load items');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        fetchItems();
    }, [searchText, selectedCategory]);

    // 處理搜索
    const handleSearch = debounce((value) => {
        setSearchText(value);
        setPagination({ ...pagination, current: 1 }); // 重置到第一頁
    }, 300);

    // 處理分類選擇
    const handleCategoryChange = (value) => {
        setSelectedCategory(value);
        setPagination({ ...pagination, current: 1 }); // 重置到第一頁
    };

    // 處理表格變更
    const handleTableChange = (newPagination, filters, sorter) => {
        fetchItems({
            current: newPagination.current,
            pageSize: newPagination.pageSize
        });
    };

    // 表格列定義
    const columns = [
        {
            title: 'PO Number',
            dataIndex: 'po_number',
            key: 'po_number',
            width: 150,
            fixed: 'left'
        },
        {
            title: 'Serial Number',
            dataIndex: 'serialnumber',
            key: 'serialnumber',
            width: 150,
            fixed: 'left'
        },
        // 動態添加分類列
        ...categories.map(category => ({
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
            render: (cost) => `$ ${Number(cost).toFixed(2)}`
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
        }
    ];

    return (
        <div style={{ padding: 24 }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* 統計卡片 */}
                <Card>
                    <Row gutter={24}>
                        <Col span={8}>
                            <Statistic 
                                title="Total Items" 
                                value={pagination.total} 
                                style={{ marginBottom: 16 }}
                            />
                        </Col>
                        <Col span={8}>
                            <Descriptions>
                                <Descriptions.Item label="Last Updated">
                                    {lastUpdated ? moment(lastUpdated).format('YYYY-MM-DD HH:mm:ss') : '-'}
                                </Descriptions.Item>
                            </Descriptions>
                        </Col>
                    </Row>
                </Card>

                {/* 搜索工具欄 */}
                <Card>
                    <Space style={{ marginBottom: 16 }}>
                        <Search
                            placeholder="Search PO Number or Serial Number"
                            allowClear
                            onSearch={handleSearch}
                            style={{ width: 300 }}
                        />
                        <Select
                            style={{ width: 200 }}
                            placeholder="Select Category"
                            allowClear
                            onChange={handleCategoryChange}
                        >
                            {categories.map(category => (
                                <Option key={category.id} value={category.id}>
                                    {category.name}
                                </Option>
                            ))}
                        </Select>
                    </Space>

                    {/* 項目列表 */}
                    <Table
                        columns={columns}
                        dataSource={items}
                        loading={loading}
                        rowKey="id"
                        scroll={{ x: 'max-content' }}
                        pagination={{
                            ...pagination,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total) => `Total ${total} items`,
                        }}
                        onChange={handleTableChange}
                    />
                </Card>
            </Space>
        </div>
    );
};

export default InboundItemsPage; 