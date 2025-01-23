import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Table, Card, message, Space, Tag, Button, Input, Collapse, Modal } from 'antd';
import { rmaApi } from '../services/api';
import AddRmaModal from '../components/AddRmaModal';
import { useAuth } from '../contexts/AuthContext';

const { Search } = Input;
const { Panel } = Collapse;
const { TextArea } = Input;

const StoreRmaPage = () => {
    const { storeId } = useParams();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [rmaItems, setRmaItems] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [filteredItems, setFilteredItems] = useState([]);
    const [editingItem, setEditingItem] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [operationLoading, setOperationLoading] = useState(false);

    const fetchRmaItems = useCallback(async () => {
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
    }, [storeId]);

    useEffect(() => {
        if (storeId) {
            fetchRmaItems();
        }
    }, [storeId, fetchRmaItems]);

    const handleSearch = (value) => {
        setSearchText(value);
        const filtered = rmaItems.filter(item => 
            item.serialnumber.toLowerCase().includes(value.toLowerCase()) ||
            item.notes?.toLowerCase().includes(value.toLowerCase())
        );
        setFilteredItems(filtered);
    };

    const handleDelete = async (rmaId) => {
        try {
            Modal.confirm({
                title: 'Delete RMA Item',
                content: 'Are you sure you want to delete this RMA item?',
                okText: 'Yes',
                okType: 'danger',
                cancelText: 'No',
                onOk: async () => {
                    const response = await rmaApi.deleteRma(storeId, rmaId);
                    if (response?.success) {
                        message.success('RMA item deleted successfully');
                        fetchRmaItems();
                    }
                }
            });
        } catch (error) {
            console.error('Error deleting RMA item:', error);
            message.error('Failed to delete RMA item');
        }
    };

    const handleSendToInventory = async (record) => {
        if (!record.reason?.trim()) {
            message.error('Please enter a reason before sending to inventory');
            return;
        }

        try {
            const response = await rmaApi.sendToInventory(storeId, record.rma_id);
            if (response.success) {
                message.success('Item sent to inventory successfully');
                await fetchRmaItems();
            }
        } catch (error) {
            message.error(error.message || 'Failed to send item to inventory');
        }
    };

    const handleSendToStore = async (rmaId) => {
        try {
            const response = await rmaApi.sendToStore(storeId, rmaId);
            if (response?.success) {
                message.success('Item sent to store inventory successfully');
                await fetchRmaItems();
            }
        } catch (error) {
            console.error('Error sending to store:', error);
            message.error('Failed to send item to store');
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

    const handleAddSuccess = async () => {
        setShowAddModal(false);
        await fetchRmaItems();
        message.success('RMA item added successfully');
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
            title: 'System SKU',
            dataIndex: 'system_sku',
            key: 'system_sku',
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
            dataIndex: 'store_status',
            key: 'store_status',
            width: 120,
            render: (status) => {
                const color = 
                    !status || status === 'pending' ? 'orange' :
                    status === 'sent_to_inventory' ? 'blue' :
                    status === 'completed' ? 'green' :
                    status === 'failed' ? 'red' : 'default';
                const displayText = status === 'sent_to_inventory' ? 'SENT' : 
                                  status?.toUpperCase() || 'PENDING';
                return <Tag color={color}>{displayText}</Tag>;
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
            render: (text, record) => {
                const isPending = !record.store_status || record.store_status === 'pending';
                
                if (isPending) {
                    return (
                        <TextArea
                            value={text || ''}
                            placeholder="Enter reason (required)"
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
                            status={!text?.trim() ? 'error' : ''}
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
                const isPending = !record.store_status || record.store_status === 'pending';
                
                if (isPending) {
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
            render: (_, record) => {
                const actions = [];

                if (record.store_status === 'pending') {
                    actions.push(
                        <Button
                            key="send"
                            type="primary"
                            size="small"
                            loading={operationLoading}
                            onClick={() => handleSendToInventory(record)}
                            disabled={!record.reason?.trim()}
                            title="Send to Inventory"
                        >
                            Send
                        </Button>
                    );
                }

                // Add delete button for admin users
                if (user?.group_name === 'admin' && record.store_status !== 'sent_to_inventory') {
                    actions.push(
                        <Button
                            key="delete"
                            type="link"
                            danger
                            size="small"
                            onClick={() => handleDelete(record.rma_id)}
                        >
                            Delete
                        </Button>
                    );
                }

                return <Space>{actions}</Space>;
            }
        }
    ];

    const pendingItems = filteredItems.filter(item => !item.store_status || item.store_status === 'pending');
    const sentItems = filteredItems.filter(item => item.store_status === 'sent_to_inventory');
    const completedItems = filteredItems.filter(item => item.store_status === 'completed');
    const failedItems = filteredItems.filter(item => item.store_status === 'failed');

    return (
        <div style={{ padding: '24px' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Space>
                    <Search
                        placeholder="Search by Serial Number or Notes"
                        allowClear
                        onSearch={handleSearch}
                        style={{ width: 300 }}
                    />
                    <Button type="primary" onClick={() => setShowAddModal(true)}>
                        Add RMA
                    </Button>
                </Space>

                {/* Pending RMA */}
                <Card title="Pending RMA">
                    <Table
                        columns={columns}
                        dataSource={pendingItems}
                        rowKey="rma_id"
                        loading={loading}
                        scroll={{ x: 1500 }}
                        pagination={false}
                    />
                </Card>

                {/* Sent to Inventory */}
                <Card title="Sent to Inventory">
                    <Table
                        columns={columns}
                        dataSource={sentItems}
                        rowKey="rma_id"
                        loading={loading}
                        scroll={{ x: 1500 }}
                        pagination={false}
                    />
                </Card>

                {/* Failed RMA */}
                <Card title="Failed RMA">
                    <Table
                        columns={columns}
                        dataSource={failedItems}
                        rowKey="rma_id"
                        loading={loading}
                        scroll={{ x: 1500 }}
                        pagination={false}
                    />
                </Card>

                {/* Completed RMA */}
                <Card title="Completed RMA">
                    <Table
                        columns={[
                            ...columns.slice(0, -1), // Remove the last column (original Actions)
                            {
                                title: 'Actions',
                                key: 'actions',
                                fixed: 'right',
                                width: 150,
                                render: (_, record) => (
                                    <Space>
                                        {record.store_status === 'completed' && (
                                            <>
                                                <Button
                                                    type="primary"
                                                    onClick={() => handleSendToStore(record.rma_id)}
                                                >
                                                    Send to Store
                                                </Button>
                                                {user?.group_name === 'admin' && (
                                                    <Button
                                                        danger
                                                        size="small"
                                                        onClick={() => handleDelete(record.rma_id)}
                                                    >
                                                        Delete
                                                    </Button>
                                                )}
                                            </>
                                        )}
                                    </Space>
                                )
                            }
                        ]}
                        dataSource={completedItems}
                        rowKey="rma_id"
                        loading={loading}
                        scroll={{ x: 1500 }}
                        pagination={{
                            showSizeChanger: true,
                            showQuickJumper: true,
                            pageSizeOptions: ['10', '20', '50']
                        }}
                    />
                </Card>

                {/* Add RMA Modal */}
                <AddRmaModal
                    visible={showAddModal}
                    onCancel={() => setShowAddModal(false)}
                    onSuccess={handleAddSuccess}
                    storeId={storeId}
                />
            </Space>
        </div>
    );
};

export default StoreRmaPage; 