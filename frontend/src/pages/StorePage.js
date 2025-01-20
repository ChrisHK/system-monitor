import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Table, message, Row, Col, Card, Statistic, Button, Input, Space, Tag, Modal, Select } from 'antd';
import { ReloadOutlined, SearchOutlined, ExportOutlined, DownloadOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { storeApi, removeFromOutbound, searchRecords, addToOutbound, sendToStore, getOutboundItems } from '../services/api';
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
    const [store, setStore] = useState(null);
    const [stores, setStores] = useState([]);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [outboundModalVisible, setOutboundModalVisible] = useState(false);
    const [outboundRecords, setOutboundRecords] = useState([]);
    const [outboundLoading, setOutboundLoading] = useState(false);
    const [selectedOutboundStore, setSelectedOutboundStore] = useState(null);

    // Modify stores fetching to use storeApi
    const fetchStores = useCallback(async () => {
        try {
            const response = await storeApi.getStores();
            if (response?.success) {
                const storesList = response.stores.map(store => ({
                    value: store.id.toString(),
                    label: store.name
                }));
                setStores(storesList);
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
            // First get the store details from the stores list
            const storesResponse = await storeApi.getStores();
            console.log('Stores response:', storesResponse);
            
            if (storesResponse?.success) {
                const currentStore = storesResponse.stores.find(store => store.id.toString() === storeId.toString());
                if (currentStore) {
                    setStore(currentStore);
                } else {
                    message.error('Store not found');
                    navigate('/inventory');
                    return;
                }
            }

            // Then get the store items
            const itemsResponse = await storeApi.getStoreItems(storeId);
            console.log('Store items response:', itemsResponse);
            
            if (itemsResponse?.success && itemsResponse.items) {
                const items = itemsResponse.items.map(item => ({
                    ...item,
                    location: store?.name || '',
                    store_name: store?.name || ''
                }));
                setRecords(items);
                setFilteredRecords(items);
            }
        } catch (error) {
            console.error('Error loading store data:', error);
            if (error.response?.status === 404) {
                message.error('Store not found');
                navigate('/inventory');
            } else {
                message.error('Failed to load store data');
            }
        } finally {
            setLoading(false);
        }
    }, [storeId, user, navigate, store?.name]);

    useEffect(() => {
        if (!user) return;
        
        const userStoreId = user.store_id?.toString();
        const requestedStoreId = storeId?.toString();

        if (user.role !== 'admin' && userStoreId !== requestedStoreId) {
            message.error('Access denied');
            navigate('/inventory');
            return;
        }

        fetchStores();
        fetchStoreData();
    }, [user, storeId, navigate, fetchStoreData, fetchStores]);

    const handleSearch = (value) => {
        if (!value) {
            setFilteredRecords(records);
            return;
        }
        
        const filtered = records.filter(record => 
            record.serialnumber.toLowerCase().includes(value.toLowerCase()) ||
            record.computername?.toLowerCase().includes(value.toLowerCase()) ||
            record.model?.toLowerCase().includes(value.toLowerCase())
        );
        setFilteredRecords(filtered);
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
            if (error.response?.data?.error?.includes('already in outbound')) {
                message.warning(`Item is already in the outbound list`);
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

            const response = await sendToStore(selectedOutboundStore, outboundIds);
            if (response?.success) {
                message.success('Items sent to store successfully');
                await fetchOutboundItems();
                handleOutboundModalClose();
            } else if (response?.error && response.error.includes('already in stores:')) {
                Modal.confirm({
                    title: 'Items Already in Store',
                    content: `${response.error}\n\nDo you want to move these items to ${selectedStoreData.label}?`,
                    okText: 'Yes, Move Items',
                    cancelText: 'No, Keep Current',
                    onOk: async () => {
                        try {
                            const retryResponse = await sendToStore(selectedOutboundStore, outboundIds, true);
                            if (retryResponse?.success) {
                                message.success('Items moved to new store successfully');
                                await fetchOutboundItems();
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
            if (error.response?.data?.error?.includes('already in stores:')) {
                Modal.confirm({
                    title: 'Items Already in Store',
                    content: `${error.response.data.error}\n\nDo you want to move these items to ${selectedStoreData.label}?`,
                    okText: 'Yes, Move Items',
                    cancelText: 'No, Keep Current',
                    onOk: async () => {
                        try {
                            const retryResponse = await sendToStore(selectedOutboundStore, outboundIds, true);
                            if (retryResponse?.success) {
                                message.success('Items moved to new store successfully');
                                await fetchOutboundItems();
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
                console.error('Error sending items to store:', error);
                message.error(error.message || 'Failed to send items to store');
            }
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
        }
    ];

    // Modify toolbar to use handleOutboundModalOpen
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
                rowKey="outbound_item_id"
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
                            columns={columns}
                dataSource={filteredRecords}
                loading={loading}
                            rowKey="serialnumber"
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
        </div>
    );
};

export default StorePage; 