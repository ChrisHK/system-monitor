import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Table, Card, message, Space, Tag, Button, Input, Collapse } from 'antd';
import { rmaApi } from '../services/api';

const { Search } = Input;
const { Panel } = Collapse;
const { TextArea } = Input;

const StoreRmaPage = () => {
    const { storeId } = useParams();
    const [loading, setLoading] = useState(false);
    const [rmaItems, setRmaItems] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [filteredItems, setFilteredItems] = useState([]);
    const [editingItem, setEditingItem] = useState(null);

    useEffect(() => {
        if (storeId) {
            fetchRmaItems();
        }
    }, [storeId]);

    const fetchRmaItems = async () => {
        try {
            setLoading(true);
            const response = await rmaApi.getRmaItems(storeId);
            if (response?.success) {
                const items = response.rma_items.map(item => ({
                    ...item,
                    key: item.rma_id
                }));
                setRmaItems(items);
                setFilteredItems(items);
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

    const handleStatusUpdate = async (rmaId, newStatus) => {
        try {
            const response = await rmaApi.updateRmaStatus(storeId, rmaId, newStatus);
            if (response?.success) {
                message.success('Status updated successfully');
                await fetchRmaItems();
            }
        } catch (error) {
            console.error('Error updating status:', error);
            message.error('Failed to update status');
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

            const response = await rmaApi.updateRmaFields(storeId, rmaId, updatedFields);
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

    const handleDelete = async (rmaId) => {
        try {
            const response = await rmaApi.deleteRma(storeId, rmaId);
            if (response?.success) {
                message.success('RMA item deleted successfully');
                await fetchRmaItems();
            }
        } catch (error) {
            console.error('Error deleting RMA:', error);
            message.error('Failed to delete RMA item');
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
            title: 'Computer Name',
            dataIndex: 'computername',
            key: 'computername',
            width: 150
        },
        {
            title: 'Model',
            dataIndex: 'model',
            key: 'model',
            width: 150
        },
        {
            title: 'RAM (GB)',
            dataIndex: 'ram_gb',
            key: 'ram_gb',
            width: 100
        },
        {
            title: 'OS',
            dataIndex: 'operating_system',
            key: 'operating_system',
            width: 150
        },
        {
            title: 'CPU',
            dataIndex: 'cpu',
            key: 'cpu',
            width: 150
        },
        {
            title: 'Disks',
            dataIndex: 'disks',
            key: 'disks',
            width: 150
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status) => {
                const color = status === 'pending' ? 'orange' : 
                            status === 'approved' ? 'green' : 
                            status === 'rejected' ? 'red' : 'default';
                return <Tag color={color}>{status?.toUpperCase() || 'PENDING'}</Tag>;
            }
        },
        {
            title: 'RMA Date',
            dataIndex: 'rma_date',
            key: 'rma_date',
            width: 150,
            render: (date) => new Date(date).toLocaleString()
        },
        {
            title: 'Reason',
            dataIndex: 'reason',
            key: 'reason',
            width: 200,
            render: (text, record) => (
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
            )
        },
        {
            title: 'Notes',
            dataIndex: 'notes',
            key: 'notes',
            render: (text, record) => (
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
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 120,
            render: (_, record) => (
                <Space>
                    {record.status === 'pending' && (
                        <Button
                            danger
                            size="small"
                            onClick={() => handleDelete(record.rma_id)}
                        >
                            Reject
                        </Button>
                    )}
                </Space>
            )
        }
    ];

    const pendingItems = filteredItems.filter(item => !item.status || item.status === 'pending');
    const completedItems = filteredItems.filter(item => item.status && item.status !== 'pending');

    return (
        <div style={{ padding: '24px' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                {/* Pending RMA Items */}
                <Card title="Pending RMA Items">
                    <Table
                        columns={columns}
                        dataSource={pendingItems}
                        rowKey="rma_id"
                        loading={loading}
                        scroll={{ x: 1200 }}
                        pagination={false}
                    />
                </Card>

                {/* Completed RMA Items */}
                <Card title="Completed RMA Items">
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                        <Search
                            placeholder="Search by Serial Number or Notes"
                            allowClear
                            onSearch={handleSearch}
                            style={{ width: 300 }}
                        />
                        <Collapse>
                            <Panel header="View Completed Items" key="1">
                                <Table
                                    columns={columns}
                                    dataSource={completedItems}
                                    rowKey="rma_id"
                                    loading={loading}
                                    scroll={{ x: 1200 }}
                                    pagination={{
                                        showSizeChanger: true,
                                        showQuickJumper: true,
                                        pageSizeOptions: ['10', '20', '50']
                                    }}
                                />
                            </Panel>
                        </Collapse>
                    </Space>
                </Card>
            </Space>
        </div>
    );
};

export default StoreRmaPage; 