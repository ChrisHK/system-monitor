import React, { useState, useEffect, useCallback } from 'react';
import { Table, Input, Button, message, Row, Col, Select } from 'antd';
import { SearchOutlined, ReloadOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons';
import { searchRecords, addToOutbound, getOutboundItems, removeFromOutbound, sendToStore, getStores } from '../services/api';

const { Search } = Input;
const { Option } = Select;

const OutboundPage = () => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedStore, setSelectedStore] = useState(null);
    const [stores, setStores] = useState([]);

    const columns = [
        {
            title: 'Serial Number',
            dataIndex: 'serialnumber',
            key: 'serialnumber',
            width: 150,
            filterable: true
        },
        {
            title: 'Computer Name',
            dataIndex: 'computername',
            key: 'computername',
            width: 150,
            filterable: true
        },
        {
            title: 'Manufacturer',
            dataIndex: 'manufacturer',
            key: 'manufacturer',
            width: 100,
            filterable: true
        },
        {
            title: 'Model',
            dataIndex: 'model',
            key: 'model',
            width: 120,
            filterable: true
        },
        {
            title: 'System SKU',
            dataIndex: 'systemsku',
            key: 'systemsku',
            width: 150,
            filterable: true,
            render: (text) => {
                if (!text) return 'N/A';
                const parts = text.split('_');
                const thinkpadPart = parts.find(part => part.includes('ThinkPad'));
                if (thinkpadPart) {
                    return parts.slice(parts.indexOf(thinkpadPart)).join(' ')
                        .replace(/Gen (\d+)$/, 'Gen$1').trim();
                }
                return text;
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 100,
            render: (_, record) => (
                <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveItem(record.outbound_item_id)}
                >
                    Delete
                </Button>
            )
        }
    ];

    const handleSearch = useCallback(async (value) => {
        if (!value) return;

        try {
            setLoading(true);
            setSearchText(value);

            // Search for record by serial number
            const response = await searchRecords('serialnumber', value);

            if (response.success && response.records.length > 0) {
                const record = response.records[0];
                
                // Add record to outbound
                const addResponse = await addToOutbound(record.id);

                if (addResponse.success) {
                    message.success('Item added to outbound successfully');
                    await fetchOutboundItems();
                }
            } else {
                message.warning('No record found with this serial number');
            }
        } catch (error) {
            console.error('Error searching:', error);
            message.error(`Failed to search: ${error.message}`);
        } finally {
            setLoading(false);
            setSearchText('');
        }
    }, []);

    const handleRemoveItem = async (itemId) => {
        try {
            setLoading(true);
            const response = await removeFromOutbound(itemId);

            if (response.success) {
                message.success('Item removed successfully');
                await fetchOutboundItems();
            }
        } catch (error) {
            console.error('Error removing item:', error);
            message.error(`Failed to remove item: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSendToStore = async () => {
        if (!selectedStore) {
            message.warning('Please select a store first');
            return;
        }

        if (records.length === 0) {
            message.warning('No items to send');
            return;
        }

        try {
            setLoading(true);
            const response = await sendToStore(selectedStore, records.map(record => record.outbound_item_id));

            if (response.success) {
                message.success('Items sent to store successfully');
                await fetchOutboundItems();
                setSelectedStore(null);
            }
        } catch (error) {
            console.error('Error sending items to store:', error);
            message.error(`Failed to send items: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchOutboundItems = async () => {
        try {
            setLoading(true);
            const response = await getOutboundItems();

            if (response.success) {
                setRecords(response.items || []);
            }
        } catch (error) {
            console.error('Error fetching outbound items:', error);
            message.error(`Failed to fetch items: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchStores = async () => {
        try {
            const response = await getStores();
            if (response.success) {
                setStores(response.stores.map(store => ({
                    value: store.id,
                    label: store.name
                })));
            }
        } catch (error) {
            console.error('Error fetching stores:', error);
            message.error(`Failed to fetch stores: ${error.message}`);
        }
    };

    useEffect(() => {
        fetchOutboundItems();
        fetchStores();
    }, []);

    const handleRefresh = () => {
        fetchOutboundItems();
    };

    return (
        <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Search
                        placeholder="Enter serial number to add..."
                        allowClear
                        enterButton={<SearchOutlined />}
                        onSearch={handleSearch}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{ width: '100%' }}
                    />
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={handleRefresh}
                        loading={loading}
                    >
                        Refresh
                    </Button>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <span style={{ marginRight: 8 }}>
                        Total Items: {records.length}
                    </span>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Select
                        placeholder="Select store"
                        style={{ width: '100%' }}
                        value={selectedStore}
                        onChange={setSelectedStore}
                    >
                        {stores.map(store => (
                            <Option key={store.value} value={store.value}>
                                {store.label}
                            </Option>
                        ))}
                    </Select>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Button
                        type="primary"
                        icon={<SendOutlined />}
                        onClick={handleSendToStore}
                        loading={loading}
                        disabled={!selectedStore || records.length === 0}
                    >
                        Send to Store
                    </Button>
                </Col>
            </Row>

            <Table
                columns={columns}
                dataSource={records}
                rowKey="id"
                loading={loading}
                scroll={{ x: 1500 }}
                pagination={{
                    total: records.length,
                    pageSize: 20,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    pageSizeOptions: ['20', '50', '100'],
                    defaultPageSize: 20
                }}
            />
        </div>
    );
};

export default OutboundPage; 