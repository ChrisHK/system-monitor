import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { 
    Table, 
    Card, 
    message, 
    Space, 
    Tag, 
    Button, 
    Input, 
    Collapse, 
    Modal,
    Alert,
    Tooltip
} from 'antd';
import { 
    DeleteOutlined, 
    EditOutlined, 
    SendOutlined, 
    SyncOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons';
import { rmaService } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { formatDate, sortDate } from '../utils/formatters';

const { Search } = Input;
const { Panel } = Collapse;
const { TextArea } = Input;
const { confirm } = Modal;

const StoreRmaPage = () => {
    const { storeId } = useParams();
    const { user } = useAuth();
    const { addNotification } = useNotification();
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [rmaItems, setRmaItems] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [filteredItems, setFilteredItems] = useState([]);
    const [editingItem, setEditingItem] = useState(null);
    const [operationLoading, setOperationLoading] = useState(false);

    const fetchRmaItems = useCallback(async () => {
        try {
            setLoading(true);
            setError('');
            const response = await rmaService.getRmaItems({ storeId });
            console.log('RMA API Response:', response);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to load RMA data');
            }
            
            const items = response.rma_items.map(item => ({
                ...item,
                key: item.rma_id,
                status: item.store_status
            }));
            console.log('Processed RMA items:', items);
            setRmaItems(items);
            setFilteredItems(items);
        } catch (error) {
            console.error('Error fetching RMA items:', error);
            setError(error.message || 'Failed to load RMA data');
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
            item.notes?.toLowerCase().includes(value.toLowerCase()) ||
            item.reason?.toLowerCase().includes(value.toLowerCase())
        );
        setFilteredItems(filtered);
    };

    const handleDelete = async (rmaId) => {
        try {
            confirm({
                title: 'Delete RMA Item',
                icon: <ExclamationCircleOutlined />,
                content: 'Are you sure you want to delete this RMA item? This action cannot be undone.',
                okText: 'Yes',
                okType: 'danger',
                cancelText: 'No',
                onOk: async () => {
                    try {
                        setOperationLoading(true);
                        setError('');
                        const response = await rmaService.deleteRma(storeId, rmaId);
                        
                        if (!response?.success) {
                            throw new Error(response?.error || 'Failed to delete RMA item');
                        }
                        
                        message.success('RMA item deleted successfully');
                        await fetchRmaItems();
                    } catch (error) {
                        console.error('Error deleting RMA item:', error);
                        setError(error.message || 'Failed to delete RMA item');
                    } finally {
                        setOperationLoading(false);
                    }
                }
            });
        } catch (error) {
            console.error('Error in delete confirmation:', error);
            setError(error.message || 'Failed to show delete confirmation');
            setOperationLoading(false);
        }
    };

    const handleSendToInventory = async (record) => {
        if (!record.reason?.trim()) {
            message.error('Please enter a reason before sending to inventory');
            return;
        }

        try {
            setOperationLoading(true);
            setError('');
            const response = await rmaService.sendToInventory(storeId, record.rma_id);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to send item to inventory');
            }
            
            // Add notification for inventory RMA
            addNotification('inventory', 'rma');
            message.success('Item sent to inventory successfully');
            await fetchRmaItems();
        } catch (error) {
            console.error('Error sending to inventory:', error);
            setError(error.message || 'Failed to send item to inventory');
        } finally {
            setOperationLoading(false);
        }
    };

    const handleSendToStore = async (rmaId) => {
        try {
            setOperationLoading(true);
            setError('');
            const response = await rmaService.sendToStore(storeId, rmaId);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to send item to store');
            }
            
            message.success('Item sent to store inventory successfully');
            await fetchRmaItems();
        } catch (error) {
            console.error('Error sending to store:', error);
            setError(error.message || 'Failed to send item to store');
        } finally {
            setOperationLoading(false);
        }
    };

    const handleFieldChange = async (rmaId, field, value) => {
        try {
            setOperationLoading(true);
            setError('');
            
            const item = rmaItems.find(item => item.rma_id === rmaId);
            if (!item) {
                throw new Error('RMA item not found');
            }

            if (field === 'reason' && (!value || value.trim() === '')) {
                throw new Error('Reason cannot be empty');
            }

            const updatedFields = {
                reason: field === 'reason' ? value : item.reason,
                notes: field === 'notes' ? value : item.notes
            };

            const response = await rmaService.updateRmaFields(storeId, rmaId, updatedFields);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to update fields');
            }
            
            message.success('Updated successfully');
            await fetchRmaItems();
        } catch (error) {
            console.error('Error updating fields:', error);
            setError(error.message || 'Failed to update fields');
        } finally {
            setOperationLoading(false);
            setEditingItem(null);
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
                return (
                    <Tooltip title={`Status: ${displayText}`}>
                        <Tag color={color}>{displayText}</Tag>
                    </Tooltip>
                );
            }
        },
        {
            title: 'RMA Date',
            dataIndex: 'rma_date',
            key: 'rma_date',
            width: 150,
            render: formatDate,
            sorter: sortDate
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
                            disabled={operationLoading}
                        />
                    );
                }
                return text;
            }
        },
        {
            title: 'Notes',
            dataIndex: 'notes',
            key: 'notes',
            width: 200,
            render: (text, record) => {
                const isFailed = record.store_status?.toLowerCase() === 'failed';
                const isSentToStore = record.store_status?.toLowerCase() === 'sent_to_store';
                const isReadOnly = isFailed || isSentToStore;

                if (isReadOnly) {
                    return text || '-';
                }

                return (
                    <TextArea
                        value={text || ''}
                        placeholder="Enter notes (optional)"
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
                        disabled={operationLoading}
                    />
                );
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 200,
            render: (_, record) => {
                console.log('RMA record:', record);
                const isPending = record.store_status?.toLowerCase() === 'pending';
                const isCompleted = record.store_status?.toLowerCase() === 'completed';

                return (
                    <Space>
                        {isPending && (
                            <Tooltip title="Send to Inventory">
                                <Button
                                    type="primary"
                                    icon={<SendOutlined />}
                                    onClick={() => handleSendToInventory(record)}
                                    disabled={!record.reason?.trim() || operationLoading}
                                    loading={operationLoading}
                                >
                                    Add to Inventory
                                </Button>
                            </Tooltip>
                        )}
                        {isCompleted && (
                            <Tooltip title="Add to Store">
                                <Button
                                    type="primary"
                                    icon={<SendOutlined />}
                                    onClick={() => handleSendToStore(record.rma_id)}
                                    loading={operationLoading}
                                >
                                    Add to Store
                                </Button>
                            </Tooltip>
                        )}
                        <Tooltip title="Delete">
                            <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => handleDelete(record.rma_id)}
                                disabled={operationLoading}
                            />
                        </Tooltip>
                    </Space>
                );
            }
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <Card 
                title="RMA Records"
                extra={
                    <Space>
                        <Search
                            placeholder="Search by serial number, notes, or reason"
                            allowClear
                            onSearch={handleSearch}
                            onChange={(e) => handleSearch(e.target.value)}
                            style={{ width: 300 }}
                            disabled={loading || operationLoading}
                        />
                        <Button
                            icon={<SyncOutlined />}
                            onClick={fetchRmaItems}
                            disabled={loading || operationLoading}
                            loading={loading}
                        >
                            Refresh
                        </Button>
                    </Space>
                }
            >
                {error && (
                    <Alert
                        message="Error"
                        description={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: 16 }}
                    />
                )}

                <Table
                    columns={columns}
                    dataSource={filteredItems}
                    rowKey="rma_id"
                    loading={loading}
                    scroll={{ x: 1500 }}
                    pagination={{
                        showSizeChanger: true,
                        showQuickJumper: true,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        showTotal: (total) => `Total ${total} records`
                    }}
                />
            </Card>
        </div>
    );
};

export default StoreRmaPage; 