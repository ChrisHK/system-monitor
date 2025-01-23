import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Table, message, Row, Col, Card, Statistic, Button, Input, Space, Tag, Modal, Select, Form, InputNumber } from 'antd';
import { ReloadOutlined, SearchOutlined, ExportOutlined, DownloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { storeApi, removeFromOutbound, searchRecords, addToOutbound, sendToStore, getOutboundItems, salesApi, rmaApi, orderApi } from '../services/api';
import { formatSystemSku } from '../utils/formatters';

const { Search } = Input;
const { Option } = Select;

// Utility functions
const formatDate = (text) => {
    if (!text) return 'N/A';
    return new Date(text).toLocaleString();
};

const formatOS = (text) => {
    if (!text || text === 'N/A') return 'N/A';
    const osLower = text.toLowerCase();
    if (osLower.includes('windows')) {
        const mainVersion = osLower.includes('11') ? '11' : 
                        osLower.includes('10') ? '10' : '';
        const edition = osLower.includes('pro') ? 'Pro' :
                    osLower.includes('home') ? 'Home' : 
                    osLower.includes('enterprise') ? 'Enterprise' : '';
        return `Windows ${mainVersion} ${edition}`.trim();
    }
    return text;
};

const StorePage = () => {
    const { storeId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const [store, setStore] = useState(null);
    const [stores, setStores] = useState([]);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [outboundModalVisible, setOutboundModalVisible] = useState(false);
    const [outboundRecords, setOutboundRecords] = useState([]);
    const [outboundLoading, setOutboundLoading] = useState(false);
    const [selectedOutboundStore, setSelectedOutboundStore] = useState(null);
    const [salesModalVisible, setSalesModalVisible] = useState(false);
    const [rmaModalVisible, setRmaModalVisible] = useState(false);
    const [searchSerialNumber, setSearchSerialNumber] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [price, setPrice] = useState(0);
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [form] = Form.useForm();
    const [selectedItems, setSelectedItems] = useState([]);
    const [searchPerformed, setSearchPerformed] = useState(false);

    // Modify stores fetching to use storeApi
    const fetchStores = useCallback(async () => {
        try {
            console.log('Fetching stores list...');
            const response = await storeApi.getStores();
            console.log('Stores response:', response);
            
            if (response?.success) {
                const storesList = response.stores.map(store => ({
                    value: store.id.toString(),
                    label: store.name
                }));
                console.log('Processed stores list:', storesList);
                setStores(storesList);
            } else {
                console.error('Failed to fetch stores:', response);
                message.error('Failed to load stores');
            }
        } catch (error) {
            console.error('Error fetching stores:', error);
            message.error('Failed to load stores');
        }
    }, []);

    const fetchStoreData = useCallback(async () => {
        if (!user || !storeId) return;

        try {
            setLoading(true);
            console.log('Fetching store data for storeId:', storeId);
            
            // 先獲取商店詳情
            const storeResponse = await storeApi.getStore(storeId);
            console.log('Store response:', storeResponse);
            
            if (storeResponse?.success) {
                setStore(storeResponse.store);
                
                // 然後獲取商店物品
                console.log('Fetching items for store:', storeResponse.store.name);
                const itemsResponse = await storeApi.getStoreItems(storeId);
                console.log('Store items response:', itemsResponse);
                
                if (itemsResponse?.success) {
                    setRecords(itemsResponse.items);
                    setFilteredRecords(itemsResponse.items);
                } else {
                    console.error('Failed to fetch store items:', itemsResponse);
                    message.error('Failed to load store items');
                }
            } else {
                console.error('Failed to fetch store:', storeResponse);
                message.error('Failed to load store information');
                navigate('/inventory');
            }
        } catch (error) {
            console.error('Error fetching store data:', error);
            if (error.response?.status === 403) {
                message.error('You do not have permission to access this store');
                navigate('/inventory');
            } else {
                message.error('Failed to load store data');
            }
        } finally {
            setLoading(false);
        }
    }, [user, storeId, navigate]);

    useEffect(() => {
        if (!user) return;
        
        console.log('Checking store access:', {
            user,
            storeId,
            isAdmin: user.group_name === 'admin',
            hasStorePermission: user.permitted_stores?.includes(Number(storeId))
        });

        // 檢查用戶是否有權限訪問該商店
        const hasPermission = user.group_name === 'admin' || user.permitted_stores?.includes(Number(storeId));
        
        if (hasPermission) {
            fetchStores();
            fetchStoreData();
        } else {
            console.log('Access denied to store:', storeId);
            message.error('You do not have permission to access this store');
            navigate('/inventory');
        }
    }, [user, storeId, navigate, fetchStoreData, fetchStores]);

    const handleSearch = (value) => {
        if (!value) {
            setFilteredRecords(records);
            setSearchPerformed(false);
            return;
        }
        
        const filtered = records.filter(record => 
            record.serialnumber.toLowerCase().includes(value.toLowerCase()) ||
            record.computername?.toLowerCase().includes(value.toLowerCase()) ||
            record.model?.toLowerCase().includes(value.toLowerCase())
        );
        setFilteredRecords(filtered);
        setSearchPerformed(true);
    };

    const handleRefresh = () => {
        fetchStoreData();
    };

    const handleOutboundModalOpen = async () => {
        setOutboundModalVisible(true);
        await fetchOutboundItems();
    };

    const handleOutboundModalClose = () => {
        setOutboundModalVisible(false);
        setSelectedOutboundStore(null);
        setOutboundRecords([]);
    };

    const fetchOutboundItems = async () => {
        try {
            setOutboundLoading(true);
            const response = await getOutboundItems();
            if (response?.items) {
                setOutboundRecords(response.items);
            }
        } catch (error) {
            console.error('Error fetching outbound items:', error);
            message.error('Failed to fetch outbound items');
        } finally {
            setOutboundLoading(false);
        }
    };

    const handleAddToOutbound = async (serialNumber) => {
        try {
            setOutboundLoading(true);
            const searchResponse = await searchRecords(serialNumber);
            if (searchResponse?.success && searchResponse.records?.length > 0) {
                const record = searchResponse.records[0];
                const addResponse = await addToOutbound(record.id);
                if (addResponse?.success) {
                    message.success('Item added to outbound successfully');
                    await fetchOutboundItems();
                } else {
                    throw new Error(addResponse?.error || 'Failed to add item to outbound');
                }
            } else {
                message.warning('No record found with this serial number');
            }
        } catch (error) {
            console.error('Add to outbound error:', error);
            if (error.response?.data?.error) {
                message.warning(error.response.data.error);
            } else {
                message.error(error.message || 'Failed to add item');
            }
        } finally {
            setOutboundLoading(false);
        }
    };

    const handleRemoveFromOutbound = async (itemId) => {
        try {
            setOutboundLoading(true);
            const response = await removeFromOutbound(itemId);
            if (response?.success) {
                message.success('Item removed successfully');
                await fetchOutboundItems();
            } else {
                throw new Error(response?.error || 'Failed to remove item');
            }
        } catch (error) {
            console.error('Remove from outbound error:', error);
            message.error(error.message || 'Failed to remove item');
        } finally {
            setOutboundLoading(false);
        }
    };

    const handleSendToStore = async () => {
        if (!selectedOutboundStore) {
            message.error('Please select a store first');
            return;
        }

        let selectedStoreData;
        let outboundIds;

        try {
            setOutboundLoading(true);
            selectedStoreData = stores.find(s => s.value === selectedOutboundStore);
            if (!selectedStoreData) {
                throw new Error('Store not found');
            }

            outboundIds = outboundRecords.map(r => r.outbound_item_id).filter(Boolean);
            if (outboundIds.length === 0) {
                throw new Error('No valid outbound items found');
            }

            console.log('Sending items to store:', { selectedOutboundStore, outboundIds });
            const response = await sendToStore(selectedOutboundStore, outboundIds);
            console.log('Send to store response:', response);

            if (response?.success) {
                // First add the notification
                console.log('Adding notification for store:', selectedOutboundStore);
                addNotification('inventory', selectedOutboundStore);
                
                // Then refresh the data
                console.log('Refreshing data...');
                await fetchOutboundItems();
                await fetchStoreData();
                
                message.success('Items sent to store successfully');
                handleOutboundModalClose();
            } else if (response?.error && response.error.includes('already in stores:')) {
                Modal.confirm({
                    title: 'Items Already in Store',
                    content: `${response.error}\n\nDo you want to move these items to ${selectedStoreData.label}?`,
                    okText: 'Yes, Move Items',
                    cancelText: 'No, Keep Current',
                    onOk: async () => {
                        try {
                            console.log('Retrying with force move:', { selectedOutboundStore, outboundIds });
                            const retryResponse = await sendToStore(selectedOutboundStore, outboundIds, true);
                            console.log('Force move response:', retryResponse);

                            if (retryResponse?.success) {
                                // First add the notification
                                console.log('Adding notification for store:', selectedOutboundStore);
                                addNotification('inventory', selectedOutboundStore);
                                
                                // Then refresh the data
                                console.log('Refreshing data...');
                                await fetchOutboundItems();
                                await fetchStoreData();
                                
                                message.success('Items moved to new store successfully');
                                handleOutboundModalClose();
                            } else {
                                throw new Error(retryResponse?.error || 'Failed to move items to new store');
                            }
                        } catch (error) {
                            console.error('Error moving items:', error);
                            message.error(error.message || 'Failed to move items to new store');
                        }
                    }
                });
            } else {
                throw new Error(response?.error || 'Failed to send items to store');
            }
        } catch (error) {
            console.error('Error sending items to store:', error);
            message.error(error.message || 'Failed to send items to store');
        } finally {
            setOutboundLoading(false);
        }
    };

    const handleExportCSV = () => {
        try {
            const headers = [
                'Serial Number',
                'Computer Name',
                'Manufacturer',
                'Model',
                'System SKU',
                'Operating System',
                'CPU',
                'Resolution',
                'Graphics Card',
                'Touch Screen',
                'RAM (GB)',
                'Disks',
                'Design Capacity',
                'Full Charge',
                'Cycle Count',
                'Battery Health',
                'Created Time'
            ];

            const csvData = filteredRecords.map(record => [
                record.serialnumber,
                record.computername || '',
                record.manufacturer || '',
                record.model || '',
                record.systemsku || '',
                formatOS(record.operatingsystem) || '',
                record.cpu || '',
                record.resolution || '',
                record.graphicscard || '',
                record.touchscreen ? 'Yes' : 'No',
                record.ram_gb || '',
                record.disks || '',
                record.design_capacity || '',
                record.full_charge_capacity || '',
                record.cycle_count || '',
                record.battery_health ? `${record.battery_health}%` : '',
                record.created_at ? new Date(record.created_at).toLocaleString() : ''
            ]);

            // Add headers to CSV data
            csvData.unshift(headers);

            // Convert to CSV string
            const csvString = csvData.map(row => row.map(cell => {
                // Handle cells that contain commas or quotes
                if (cell && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
                    return `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
            }).join(',')).join('\n');

            // Create blob and download
            const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `store_${storeId}_inventory_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            message.success('Export successful');
        } catch (error) {
            console.error('Export error:', error);
            message.error('Failed to export data');
        }
    };

    const handleSalesClick = () => {
        setSalesModalVisible(true);
        setSearchSerialNumber('');
        setSelectedItem(null);
        setPrice(0);
        setNotes('');
    };

    const handleRmaClick = () => {
        setRmaModalVisible(true);
        setSearchSerialNumber('');
        setSelectedItem(null);
        setReason('');
        setNotes('');
    };

    const handleSalesSearch = async () => {
        if (!searchSerialNumber) {
            message.warning('Please enter a serial number');
            return;
        }
        
        try {
            setLoading(true);
            const response = await storeApi.searchItems(storeId, searchSerialNumber);
            if (response.data && response.data.success) {
                const items = response.data.items || [];
                if (items.length === 0) {
                    message.warning('No items found with this serial number');
                    setFilteredRecords([]);
                    setSearchPerformed(false);
                    return;
                }
                // Process items to ensure unique keys
                const processedItems = items.map((item, index) => ({
                    ...item,
                    uniqueKey: `store-${item.id}-${item.serialnumber}-${item.store_id || storeId}-${item.received_at || Date.now()}-${index}`
                }));
                setFilteredRecords(processedItems);
                setSearchPerformed(true);
            } else {
                message.error('Failed to search items');
                setFilteredRecords([]);
                setSearchPerformed(false);
            }
        } catch (error) {
            console.error('Search error:', error);
            message.error('Error searching items');
            setFilteredRecords([]);
            setSearchPerformed(false);
        } finally {
            setLoading(false);
        }
    };

    const handleRmaSearch = async () => {
        try {
            const result = await salesApi.searchSales(storeId, searchSerialNumber);
            if (result.data) {
                setSelectedItem(result.data);
            } else {
                message.error('Item not found in sales');
                setSelectedItem(null);
            }
        } catch (error) {
            message.error('Error searching for item');
            console.error(error);
        }
    };

    const handleSalesSubmit = async () => {
        try {
            if (!selectedItem || !price) {
                message.error('Please select an item and enter a price');
                return;
            }

            await salesApi.addToSales(storeId, {
                recordId: selectedItem.id,
                price,
                notes
            });

            message.success('Item added to sales successfully');
            setSalesModalVisible(false);
            fetchStoreData(); // Refresh the items list
            navigate(`/stores/${storeId}/sales`);
        } catch (error) {
            message.error('Error adding item to sales');
            console.error(error);
        }
    };

    const handleRmaSubmit = async () => {
        try {
            if (!selectedItem || !reason) {
                message.error('Please select an item and enter a reason');
                return;
            }

            const response = await rmaApi.addToRma(storeId, {
                recordId: selectedItem.id,
                reason,
                notes
            });

            if (response?.success) {
                // Add notification for RMA
                console.log('Adding RMA notification for store:', storeId);
                addNotification('rma', storeId);
                
                message.success('Item added to RMA successfully');
                setRmaModalVisible(false);
                fetchStoreData();
                navigate(`/stores/${storeId}/rma`);
            } else {
                throw new Error(response?.error || 'Failed to add item to RMA');
            }
        } catch (error) {
            console.error('RMA submit error:', error);
            message.error(error.message || 'Failed to add item to RMA');
        }
    };

    const handleDeleteItem = async (itemId) => {
        try {
            const response = await storeApi.deleteStoreItem(storeId, itemId);
            if (response && response.success) {
                message.success('Item deleted successfully');
                navigate('/inventory/items');
            } else {
                message.error('Failed to delete item');
            }
        } catch (error) {
            console.error('Delete error:', error);
            message.error('Error deleting item');
        }
    };

    const showDeleteConfirm = (itemId) => {
        Modal.confirm({
            title: 'Are you sure you want to delete this item?',
            content: 'This action cannot be undone.',
            okText: 'Yes',
            okType: 'danger',
            cancelText: 'No',
            onOk() {
                handleDeleteItem(itemId);
            },
        });
    };

    const columns = [
        {
            title: 'Location',
            dataIndex: 'location',
            key: 'location',
            width: 120,
            render: (_, record) => (
                        <Tag color="blue" style={{ minWidth: '80px', textAlign: 'center' }}>
                    {record.store_name || store?.name || ''}
                        </Tag>
            )
        },
        {
            title: 'Serial Number',
            dataIndex: 'serialnumber',
            key: 'serialnumber',
            width: 150,
            sorter: (a, b) => a.serialnumber.localeCompare(b.serialnumber)
        },
        {
            title: 'Computer Name',
            dataIndex: 'computername',
            key: 'computername',
            width: 150,
            sorter: (a, b) => (a.computername || '').localeCompare(b.computername || '')
        },
        {
            title: 'Manufacturer',
            dataIndex: 'manufacturer',
            key: 'manufacturer',
            width: 100
        },
        {
            title: 'Model',
            dataIndex: 'model',
            key: 'model',
            width: 120
        },
        {
            title: 'System SKU',
            dataIndex: 'systemsku',
            key: 'systemsku',
            width: 150,
            render: formatSystemSku
        },
        {
            title: 'Operating System',
            dataIndex: 'operatingsystem',
            key: 'operatingsystem',
            width: 150,
            render: formatOS
        },
        {
            title: 'CPU',
            dataIndex: 'cpu',
            key: 'cpu',
            width: 180,
            render: (text) => {
                if (!text || text === 'N/A') return 'N/A';
                return text.replace(/\s*\([^)]*\)/g, '').trim();
            }
        },
        {
            title: 'Resolution',
            dataIndex: 'resolution',
            key: 'resolution',
            width: 120
        },
        {
            title: 'Graphics Card',
            dataIndex: 'graphicscard',
            key: 'graphicscard',
            width: 150,
            render: (text) => {
                if (!text || text === 'N/A') return 'N/A';
                return text.split('[')[0].trim();
            }
        },
        {
            title: 'Touch Screen',
            dataIndex: 'touchscreen',
            key: 'touchscreen',
            width: 100,
            render: (value) => value ? 'Yes' : 'No'
        },
        {
            title: 'RAM (GB)',
            dataIndex: 'ram_gb',
            key: 'ram_gb',
            width: 100,
            render: (text) => text || 'N/A'
        },
        {
            title: 'Disks',
            dataIndex: 'disks',
            key: 'disks',
            width: 150,
            render: (text) => text || 'N/A'
        },
        {
            title: 'Design Capacity',
            dataIndex: 'design_capacity',
            key: 'design_capacity',
            width: 120,
            render: (text) => text || 'N/A'
        },
        {
            title: 'Full Charge',
            dataIndex: 'full_charge_capacity',
            key: 'full_charge_capacity',
            width: 120,
            render: (text) => text || 'N/A'
        },
        {
            title: 'Cycle Count',
            dataIndex: 'cycle_count',
            key: 'cycle_count',
            width: 100,
            render: (text) => text || 'N/A'
        },
        {
            title: 'Battery Health',
            dataIndex: 'battery_health',
            key: 'battery_health',
            width: 120,
            render: (health) => {
                let color = 'green';
                if (health < 50) color = 'red';
                else if (health < 80) color = 'orange';
                return health ? <Tag color={color}>{health}%</Tag> : 'N/A';
            }
        },
        {
            title: 'Received At',
            dataIndex: 'received_at',
            key: 'received_at',
            width: 150,
            render: formatDate,
            sorter: (a, b) => new Date(a.received_at) - new Date(b.received_at)
        },
        user?.group_name === 'admin' && {
            title: 'Actions',
            key: 'actions',
            width: 100,
            render: (_, record) => (
                <Button
                    type="link"
                    danger
                    onClick={() => showDeleteConfirm(record.id)}
                    icon={<DeleteOutlined />}
                >
                    Delete
                </Button>
            )
        }
    ].filter(Boolean);

    const rowSelection = {
        selectedRowKeys: selectedItems.map(item => item.uniqueKey || `store-${item.id}-${item.serialnumber}-${item.store_id || storeId}-${item.received_at || Date.now()}`),
        onChange: (selectedRowKeys, selectedRows) => {
            console.log('Selected rows:', selectedRows);
            setSelectedItems(selectedRows);
        }
    };

    const handleAddToOrder = async (selectedItems) => {
        if (!selectedItems || selectedItems.length === 0) {
            message.warning('Please select items to add to order');
            return;
        }

        try {
            console.log('Adding items to order:', selectedItems);
            // Format items with required fields
            const items = selectedItems.map(item => ({
                recordId: item.id,
                serialnumber: item.serialnumber,
                notes: '',
                price: 0
            }));

            console.log('Formatted items:', items);
            const response = await orderApi.addToOrder(storeId, items);

            if (response && response.success) {
                // Add notification for order
                console.log('Adding order notification for store:', storeId);
                addNotification('order', storeId);
                
                message.success('Items added to order successfully');
                setSelectedItems([]);
                setSearchPerformed(false);
                fetchStoreData();
            } else {
                const errorMsg = response?.error || 'Failed to add items to order';
                message.error(errorMsg);
                console.error('Add to order failed:', errorMsg);
            }
        } catch (error) {
            console.error('Add to order error:', error);
            const errorMsg = error.response?.data?.error || error.message || 'Error adding items to order';
            message.error(errorMsg);
        }
    };

    // Modify renderToolbar function
    const renderToolbar = () => (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col flex="auto">
                <Search
                    placeholder="Search records..."
                    allowClear
                    enterButton={<SearchOutlined />}
                    onSearch={handleSearch}
                    style={{ width: 300 }}
                />
            </Col>
            <Col>
                <Space>
                    {searchPerformed && (
                        <Button
                            type="primary"
                            onClick={() => {
                                if (selectedItems.length === 0) {
                                    message.warning('Please select items to add to order');
                                    return;
                                }
                                handleAddToOrder(selectedItems);
                            }}
                            disabled={!selectedItems.length}
                        >
                            Add to Order ({selectedItems.length})
                        </Button>
                    )}
                    <Button
                        type="primary"
                        icon={<ExportOutlined />}
                        onClick={handleOutboundModalOpen}
                    >
                        Outbound
                    </Button>
                    <Button
                        icon={<DownloadOutlined />}
                        onClick={handleExportCSV}
                    >
                        Export CSV
                    </Button>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={handleRefresh}
                        loading={loading}
                    >
                        Refresh
                    </Button>
                </Space>
            </Col>
        </Row>
    );

    // Add OutboundModal component
    const renderOutboundModal = () => (
        <Modal
            title="Outbound Management"
            visible={outboundModalVisible}
            onCancel={handleOutboundModalClose}
            width={1000}
            footer={null}
        >
            <Row gutter={[16, 16]}>
                <Col span={8}>
                    <Search
                        placeholder="Enter serial number to add..."
                        allowClear
                        enterButton="Add"
                        onSearch={handleAddToOutbound}
                    />
                </Col>
                <Col span={8}>
                    <Select
                        style={{ width: '100%' }}
                        placeholder="Select store"
                        value={selectedOutboundStore}
                        onChange={setSelectedOutboundStore}
                    >
                        {stores.filter(store => store.value !== 'all').map(store => (
                            <Option key={store.value} value={store.value}>
                                {store.label}
                            </Option>
                        ))}
                    </Select>
                </Col>
                <Col span={8}>
                    <Button
                        type="primary"
                        onClick={handleSendToStore}
                        disabled={!selectedOutboundStore || outboundRecords.length === 0}
                        loading={outboundLoading}
                    >
                        Send to Store
                    </Button>
                </Col>
            </Row>
            <Table
                columns={[
                    {
                        title: 'Serial Number',
                        dataIndex: 'serialnumber',
                        key: 'serialnumber'
                    },
                    {
                        title: 'Computer Name',
                        dataIndex: 'computername',
                        key: 'computername'
                    },
                    {
                        title: 'Model',
                        dataIndex: 'model',
                        key: 'model'
                    },
                    {
                        title: 'Actions',
                        key: 'actions',
                        render: (_, record) => (
                            <Button
                                type="link"
                                danger
                                onClick={() => handleRemoveFromOutbound(record.outbound_item_id)}
                            >
                                Remove
                            </Button>
                        )
                    }
                ]}
                dataSource={outboundRecords}
                rowKey={record => `outbound-${record.outbound_item_id}-${record.serialnumber || 'no-serial'}-${record.created_at || Date.now()}`}
                loading={outboundLoading}
                style={{ marginTop: 16 }}
                pagination={{
                    total: outboundRecords.length,
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: (total) => `Total ${total} items`
                }}
            />
        </Modal>
    );

    const renderSalesModal = () => (
        <Modal
            title="Add to Sales"
            open={salesModalVisible}
            onOk={handleSalesSubmit}
            onCancel={() => setSalesModalVisible(false)}
        >
            <Form form={form} layout="vertical">
                <Form.Item label="Serial Number">
                    <Space>
                        <Input
                            value={searchSerialNumber}
                            onChange={(e) => setSearchSerialNumber(e.target.value)}
                            placeholder="Enter serial number"
                        />
                        <Button onClick={handleSalesSearch}>Search</Button>
                    </Space>
                </Form.Item>
                {selectedItem && (
                    <>
                        <Form.Item label="Item Details">
                            <div>
                                <p>Computer Name: {selectedItem.computerName}</p>
                                <p>Model: {selectedItem.model}</p>
                            </div>
                        </Form.Item>
                        <Form.Item label="Price">
                            <InputNumber
                                value={price}
                                onChange={setPrice}
                                min={0}
                                precision={2}
                                style={{ width: '100%' }}
                            />
                        </Form.Item>
                        <Form.Item label="Notes">
                            <Input.TextArea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={4}
                            />
                        </Form.Item>
                    </>
                )}
            </Form>
        </Modal>
    );

    const renderRmaModal = () => (
        <Modal
            title="Add to RMA"
            open={rmaModalVisible}
            onOk={handleRmaSubmit}
            onCancel={() => setRmaModalVisible(false)}
        >
            <Form form={form} layout="vertical">
                <Form.Item label="Serial Number">
                    <Space>
                        <Input
                            value={searchSerialNumber}
                            onChange={(e) => setSearchSerialNumber(e.target.value)}
                            placeholder="Enter serial number"
                        />
                        <Button onClick={handleRmaSearch}>Search</Button>
                    </Space>
                </Form.Item>
                {selectedItem && (
                    <>
                        <Form.Item label="Item Details">
                            <div>
                                <p>Computer Name: {selectedItem.computerName}</p>
                                <p>Model: {selectedItem.model}</p>
                            </div>
                        </Form.Item>
                        <Form.Item label="Reason">
                            <Input.TextArea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={4}
                                placeholder="Enter RMA reason"
                            />
                        </Form.Item>
                        <Form.Item label="Notes">
                            <Input.TextArea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={4}
                            />
                        </Form.Item>
                    </>
                )}
            </Form>
        </Modal>
    );

    return (
        <div className="page-container">
            <Row gutter={[16, 16]} className="header-row">
                <Col span={24}>
                    <h1>{store?.name || 'Store'} Inventory</h1>
                </Col>
            </Row>

            <Row gutter={[16, 16]} className="stats-row">
                <Col span={8}>
                    <Card>
                        <Statistic 
                            title="Total Items" 
                            value={records.length} 
                        />
                    </Card>
                </Col>
            </Row>

            {renderToolbar()}
            
            <Table
                rowSelection={searchPerformed ? rowSelection : undefined}
                columns={columns}
                dataSource={filteredRecords}
                loading={loading}
                rowKey={record => record.uniqueKey || `store-${record.id}-${record.serialnumber}-${record.store_id || storeId}-${record.received_at || Date.now()}`}
                scroll={{ x: true }}
                pagination={{
                    total: filteredRecords.length,
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `Total ${total} items`
                }}
            />

            {renderOutboundModal()}
            {renderSalesModal()}
            {renderRmaModal()}
        </div>
    );
};

export default StorePage; 