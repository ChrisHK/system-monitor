import React, { useState, useEffect } from 'react';
import { Table, Card, message, Space, Tag, Button, Input, Collapse } from 'antd';
import { rmaApi } from '../services/api';

const { Search } = Input;
const { Panel } = Collapse;
const { TextArea } = Input;

const InventoryRmaPage = () => {
    const [loading, setLoading] = useState(false);
    const [rmaItems, setRmaItems] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [filteredItems, setFilteredItems] = useState([]);
    const [editingItem, setEditingItem] = useState(null);

    useEffect(() => {
        fetchRmaItems();
    }, []);

    const fetchRmaItems = async () => {
        try {
            setLoading(true);
            console.log('Fetching inventory RMA items...');
            const response = await rmaApi.getInventoryRmaItems();
            console.log('Inventory RMA response:', response);
            
            if (response?.success && Array.isArray(response.rma_items)) {
                const items = response.rma_items.map(item => ({
                    ...item,
                    key: item.rma_id || item.id
                }));
                console.log('Processed items:', items);
                setRmaItems(items);
                setFilteredItems(items);
            } else {
                console.error('Invalid response format:', response);
                message.error('Failed to load RMA data: Invalid response format');
            }
        } catch (error) {
            console.error('Error fetching RMA items:', error);
            message.error('Failed to load RMA data');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (value) => {
        setSearchText(value);
        const filtered = rmaItems.filter(item => 
            item.serialnumber.toLowerCase().includes(value.toLowerCase()) ||
            item.notes?.toLowerCase().includes(value.toLowerCase())
        );
        setFilteredItems(filtered);
    };

    const handleProcess = async (rmaId) => {
        try {
            const response = await rmaApi.processRma(rmaId);
            if (response?.success) {
                message.success('RMA item moved to processing');
                await fetchRmaItems();
            }
        } catch (error) {
            console.error('Error processing RMA:', error);
            message.error('Failed to process RMA item');
        }
    };

    const handleComplete = async (rmaId) => {
        try {
            const response = await rmaApi.completeRma(rmaId);
            if (response?.success) {
                message.success('RMA item completed successfully');
                await fetchRmaItems();
            }
        } catch (error) {
            console.error('Error completing RMA:', error);
            message.error('Failed to complete RMA item');
        }
    };

    const handleFail = async (rmaId) => {
        try {
            const response = await rmaApi.failRma(rmaId);
            if (response?.success) {
                message.success('RMA item marked as failed and returned to store');
                await fetchRmaItems();
            }
        } catch (error) {
            console.error('Error marking RMA as failed:', error);
            message.error('Failed to mark RMA item as failed');
        }
    };

    const handleFieldChange = async (rmaId, field, value) => {
        try {
            const item = rmaItems.find(item => item.rma_id === rmaId);
            if (!item) return;

            if (field === 'reason' && (!value || value.trim() === '')) {
                message.error('Reason cannot be empty');
                return;
            }

            const updatedFields = {
                reason: field === 'reason' ? value : item.reason,
                notes: field === 'notes' ? value : item.notes
            };

            const response = await rmaApi.updateRmaFields(item.store_id, rmaId, updatedFields);
            if (response?.success) {
                message.success('Updated successfully');
                await fetchRmaItems();
            }
        } catch (error) {
            console.error('Error updating fields:', error);
            message.error('Failed to update');
        } finally {
            setEditingItem(null);
        }
    };

    const columns = [
        {
            title: 'Serial Number',
            dataIndex: 'serialnumber',
            key: 'serialnumber',
            width: 150
        },
        {
            title: 'Store',
            dataIndex: 'store_name',
            key: 'store_name',
            width: 150
        },
        {
            title: 'Model',
            dataIndex: 'model',
            key: 'model',
            width: 150
        },
        {
            title: 'System SKU',
            dataIndex: 'system_sku',
            key: 'system_sku',
            width: 150
        },
        {
            title: 'From Store',
            dataIndex: 'store_name',
            key: 'store_name',
            width: 120,
        },
        {
            title: 'Status',
            dataIndex: 'inventory_status',
            key: 'inventory_status',
            width: 120,
            render: (status) => {
                const color = 
                    status === 'receive' ? 'orange' : 
                    status === 'process' ? 'blue' :
                    status === 'complete' ? 'green' : 
                    status === 'failed' ? 'red' : 'default';
                return <Tag color={color}>{status?.toUpperCase()}</Tag>;
            }
        },
        {
            title: 'Received Date',
            dataIndex: 'received_at',
            key: 'received_at',
            width: 150,
            render: (date) => date ? new Date(date).toLocaleString() : '-'
        },
        {
            title: 'Processed Date',
            dataIndex: 'processed_at',
            key: 'processed_at',
            width: 150,
            render: (date) => date ? new Date(date).toLocaleString() : '-'
        },
        {
            title: 'Completed Date',
            dataIndex: 'completed_at',
            key: 'completed_at',
            width: 150,
            render: (date) => date ? new Date(date).toLocaleString() : '-'
        },
        {
            title: 'Reason',
            dataIndex: 'reason',
            key: 'reason',
            width: 200,
            render: (text, record) => {
                const isProcessing = record.inventory_status === 'process';
                
                if (isProcessing) {
                    return (
                        <TextArea
                            value={text}
                            autoSize
                            onFocus={() => setEditingItem(record.rma_id)}
                            onBlur={(e) => handleFieldChange(record.rma_id, 'reason', e.target.value)}
                            onChange={(e) => {
                                const newItems = rmaItems.map(item => 
                                    item.rma_id === record.rma_id 
                                        ? { ...item, reason: e.target.value }
                                        : item
                                );
                                setRmaItems(newItems);
                                setFilteredItems(newItems);
                            }}
                            status={editingItem === record.rma_id && (!text || text.trim() === '') ? 'error' : ''}
                        />
                    );
                }
                
                return <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>;
            }
        },
        {
            title: 'Notes',
            dataIndex: 'notes',
            key: 'notes',
            width: 200,
            render: (text, record) => {
                const isProcessing = record.inventory_status === 'process';
                
                if (isProcessing) {
                    return (
                        <TextArea
                            value={text}
                            autoSize
                            onFocus={() => setEditingItem(record.rma_id)}
                            onBlur={(e) => handleFieldChange(record.rma_id, 'notes', e.target.value)}
                            onChange={(e) => {
                                const newItems = rmaItems.map(item => 
                                    item.rma_id === record.rma_id 
                                        ? { ...item, notes: e.target.value }
                                        : item
                                );
                                setRmaItems(newItems);
                                setFilteredItems(newItems);
                            }}
                        />
                    );
                }
                
                return <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>;
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 150,
            render: (_, record) => (
                <Space>
                    {record.inventory_status === 'receive' && (
                        <Button
                            type="primary"
                            size="small"
                            onClick={() => handleProcess(record.rma_id)}
                        >
                            Process
                        </Button>
                    )}
                    {record.inventory_status === 'process' && (
                        <>
                            <Button
                                type="primary"
                                size="small"
                                onClick={() => handleComplete(record.rma_id)}
                            >
                                Complete
                            </Button>
                            <Button
                                danger
                                size="small"
                                onClick={() => handleFail(record.rma_id)}
                            >
                                Failed
                            </Button>
                        </>
                    )}
                </Space>
            )
        }
    ];

    const receiveItems = filteredItems.filter(item => item.inventory_status === 'receive');
    const processItems = filteredItems.filter(item => item.inventory_status === 'process');
    const completeItems = filteredItems.filter(item => item.inventory_status === 'complete');
    const failedItems = filteredItems.filter(item => item.inventory_status === 'failed');

    return (
        <div style={{ padding: '24px' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Search
                    placeholder="Search by Serial Number or Notes"
                    allowClear
                    onSearch={handleSearch}
                    style={{ width: 300 }}
                />

                {/* Receive RAM */}
                <Card title="Receive RAM">
                    <Table
                        columns={columns}
                        dataSource={receiveItems}
                        rowKey="rma_id"
                        loading={loading}
                        scroll={{ x: 1500 }}
                        pagination={false}
                    />
                </Card>

                {/* Process RAM */}
                <Card title="Process RAM">
                    <Table
                        columns={columns}
                        dataSource={processItems}
                        rowKey="rma_id"
                        loading={loading}
                        scroll={{ x: 1500 }}
                        pagination={false}
                    />
                </Card>

                {/* Failed RAM */}
                <Card title="Failed RAM">
                    <Table
                        columns={columns}
                        dataSource={failedItems}
                        rowKey="rma_id"
                        loading={loading}
                        scroll={{ x: 1500 }}
                        pagination={false}
                    />
                </Card>

                {/* Complete RAM */}
                <Card title="Complete RAM">
                    <Collapse>
                        <Panel header="View Completed Items" key="1">
                            <Table
                                columns={columns}
                                dataSource={completeItems}
                                rowKey="rma_id"
                                loading={loading}
                                scroll={{ x: 1500 }}
                                pagination={{
                                    showSizeChanger: true,
                                    showQuickJumper: true,
                                    pageSizeOptions: ['10', '20', '50']
                                }}
                            />
                        </Panel>
                    </Collapse>
                </Card>
            </Space>
        </div>
    );
};

export default InventoryRmaPage; 