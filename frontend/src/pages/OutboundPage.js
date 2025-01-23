import React, { useState, useEffect, useCallback } from 'react';
import { Table, Input, Button, message, Row, Col, Select, Tag } from 'antd';
import { SearchOutlined, ReloadOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons';
import { searchRecords, addToOutbound, getOutboundItems, removeFromOutbound, sendToStore, storeApi, checkItemLocation } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';

const { Search } = Input;
const { Option } = Select;

const OutboundPage = () => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [addSerialNumber, setAddSerialNumber] = useState('');
    const [selectedStore, setSelectedStore] = useState(null);
    const [stores, setStores] = useState([]);
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [itemLocations, setItemLocations] = useState({});
    const { addNotification } = useNotification();

    const columns = [
        {
            title: 'Location',
            dataIndex: 'serialnumber',
            key: 'location',
            width: 120,
            render: (serialnumber) => {
                const location = itemLocations[serialnumber];
                if (!location) {
                    return <Tag color="default">Unknown</Tag>;
                }
                if (location.location === 'store') {
                    return (
                        <Tag color="blue" style={{ minWidth: '80px', textAlign: 'center' }}>
                            {location.store_name || 'Store'}
                        </Tag>
                    );
                }
                if (location.location === 'inventory') {
                    return (
                        <Tag color="green" style={{ minWidth: '80px', textAlign: 'center' }}>
                            Inventory
                        </Tag>
                    );
                }
                return (
                    <Tag color="default" style={{ minWidth: '80px', textAlign: 'center' }}>
                        {location.location || 'Unknown'}
                    </Tag>
                );
            }
        },
        {
            title: 'Serial Number',
            dataIndex: 'serialnumber',
            key: 'serialnumber',
            width: 200
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
            title: 'Operating System',
            dataIndex: 'operatingsystem',
            key: 'operatingsystem',
            width: 150,
            render: (text) => {
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
            }
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
            title: 'Created Time',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 150,
            render: (text) => {
                if (!text) return 'N/A';
                return new Date(text).toLocaleString();
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
        const searchValue = value.toLowerCase().trim();
        setSearchText(value);
        
        if (!searchValue) {
            setFilteredRecords([]);
            return;
        }
        
        try {
            setLoading(true);
            // Search for record in inventory
            const response = await searchRecords(searchValue);
            
            if (response?.data?.success && response.data.records?.length > 0) {
                const records = response.data.records;
                
                // Check locations for found records
                const locationPromises = records.map(record => 
                    checkItemLocation(record.serialnumber)
                        .catch(error => {
                            console.warn(`Failed to check location for ${record.serialnumber}:`, error);
                            return { data: { success: true, location: 'unknown' } };
                        })
                );
                
                const locations = await Promise.all(locationPromises);
                const locationMap = {};
                locations.forEach((loc, index) => {
                    if (loc?.data?.success) {
                        locationMap[records[index].serialnumber] = loc.data;
                    }
                });
                
                setItemLocations(prev => ({
                    ...prev,
                    ...locationMap
                }));
                
                setFilteredRecords(records);
            } else {
                message.warning('No records found');
                setFilteredRecords([]);
            }
        } catch (error) {
            console.error('Search error:', error);
            message.error(`Search failed: ${error.message}`);
            setFilteredRecords([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchOutboundItems = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getOutboundItems();
            
            if (response?.items) {
                setRecords(response.items);

                // Fetch locations for all items
                const locationPromises = response.items.map(item => 
                    checkItemLocation(item.serialnumber)
                        .then(location => [item.serialnumber, location])
                        .catch(() => [item.serialnumber, { location: 'unknown' }])
                );

                const locations = await Promise.all(locationPromises);
                const locationMap = Object.fromEntries(locations);
                setItemLocations(locationMap);
            }
        } catch (error) {
            message.error('Failed to fetch outbound items');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchStores = useCallback(async () => {
        try {
            console.log('Fetching stores for outbound page...');
            const response = await storeApi.getStores();
            console.log('Outbound stores response:', response);

            if (response?.success) {
                const validStores = response.stores
                    .filter(store => store && (store.id || store.value))
                    .map(store => ({
                        value: store.id?.toString() || store.value?.toString(),
                        label: store.name || 'Unknown Store'
                    }));
                console.log('Valid stores:', validStores);
                setStores(validStores);
            } else {
                throw new Error(response?.error || 'Failed to fetch stores');
            }
        } catch (error) {
            console.error('Error fetching stores:', error);
            message.error('Failed to load stores');
        }
    }, []);

    // Effect for initial data fetch
    useEffect(() => {
        fetchOutboundItems();
        fetchStores();
    }, [fetchOutboundItems, fetchStores]);

    const handleStoreChange = useCallback((value) => {
        console.log('Store selected:', value);
        const storeId = value?.toString();
        console.log('Store ID:', storeId);
        setSelectedStore(storeId);
    }, []);

    const handleRefresh = useCallback(() => {
        fetchOutboundItems();
    }, [fetchOutboundItems]);

    const handleRemoveItem = async (itemId) => {
        try {
            setLoading(true);
            const response = await removeFromOutbound(itemId);

            if (response.success) {
                message.success('Item removed successfully');
                await fetchOutboundItems();
            }
        } catch (error) {
            message.error(`Failed to remove item: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSendToStore = async () => {
        if (!selectedStore) {
            message.error('Please select a store first');
            return;
        }

        try {
            setLoading(true);
            
            // Get the store details for location update
            const selectedStoreData = stores.find(s => s.value === selectedStore);
            if (!selectedStoreData) {
                throw new Error('Store not found');
            }

            // Log the full records for debugging
            console.log('Current records:', records);

            // Get the outbound item IDs - using outbound_item_id
            const outboundIds = records.map(r => r.outbound_item_id).filter(Boolean);
            if (outboundIds.length === 0) {
                throw new Error('No valid outbound items found');
            }

            console.log('Sending items to store:', { 
                selectedStore,
                outboundIds,
                records: records.map(r => ({ 
                    id: r.id,
                    outbound_item_id: r.outbound_item_id,
                    serialnumber: r.serialnumber 
                }))
            });

            // Send items to store using outbound IDs
            const response = await sendToStore(selectedStore, outboundIds);
            console.log('Send to store response:', response);
            
            if (response?.success) {
                // Update locations for sent items
                const newLocations = {};
                records.forEach(record => {
                    newLocations[record.serialnumber] = {
                        location: 'store',
                        store_name: selectedStoreData.label,
                        store_id: selectedStore
                    };
                });

                // Update itemLocations state
                setItemLocations(prev => ({
                    ...prev,
                    ...newLocations
                }));

                message.success('Items sent to store successfully');
                await fetchOutboundItems();
            } else {
                // Check if items are already in stores
                if (response?.error?.includes('already in stores:')) {
                    const confirmMove = window.confirm(
                        `${response.error}\n\nDo you want to move these items to ${selectedStoreData.label}?`
                    );
                    
                    if (confirmMove) {
                        // Retry sending with force flag
                        const retryResponse = await sendToStore(selectedStore, outboundIds, true);
                        if (retryResponse?.success) {
                            // Update locations for sent items
                            const newLocations = {};
                            records.forEach(record => {
                                newLocations[record.serialnumber] = {
                                    location: 'store',
                                    store_name: selectedStoreData.label,
                                    store_id: selectedStore
                                };
                            });

                            // Update itemLocations state
                            setItemLocations(prev => ({
                                ...prev,
                                ...newLocations
                            }));

                            message.success('Items moved to new store successfully');
                            await fetchOutboundItems();
                        } else {
                            throw new Error(retryResponse?.error || 'Failed to move items to new store');
                        }
                    }
                } else {
                    throw new Error(response?.error || 'Failed to send items to store');
                }
            }
        } catch (error) {
            console.error('Error sending items to store:', error);
            message.error(error.message || 'Failed to send items to store');
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = useCallback(async (serialNumber) => {
        if (!serialNumber) return;

        try {
            setLoading(true);
            // First check if the item is already in the outbound list
            const isDuplicate = records.some(record => record.serialnumber === serialNumber);
            if (isDuplicate) {
                message.warning(`Serial Number ${serialNumber} is already in the outbound list`);
                setAddSerialNumber('');
                return;
            }

            // Search for record in inventory
            const searchResponse = await searchRecords(serialNumber);
            console.log('Search response:', searchResponse);
            
            // Check if we have a valid record
            if (searchResponse?.success && searchResponse.records?.length > 0) {
                const record = searchResponse.records[0];
                console.log('Found record:', record);
                
                // Add to outbound
                const addResponse = await addToOutbound(record.id);
                console.log('Add to outbound response:', addResponse);

                if (addResponse?.success) {
                    message.success('Item added to outbound successfully');
                    await fetchOutboundItems();
                    setAddSerialNumber('');
                } else {
                    throw new Error(addResponse?.error || 'Failed to add item to outbound');
                }
            } else {
                console.log('No record found. Search response:', searchResponse);
                message.warning('No record found with this serial number');
            }
        } catch (error) {
            console.error('Add item error:', error);
            if (error.response?.data?.error?.includes('already in outbound')) {
                message.warning(`Serial Number ${serialNumber} is already in the outbound list`);
            } else {
                message.error(error.message || 'Failed to add item');
            }
        } finally {
            setLoading(false);
            setAddSerialNumber('');
        }
    }, [records, fetchOutboundItems]);

    // Update the columns definition to include row highlighting
    const getRowClassName = (record) => {
        return '';
    };

    const handleSendToInventory = async (record) => {
        try {
            const response = await outboundApi.sendToInventory(storeId, record.id);
            if (response.success) {
                // Add notification for the target store
                addNotification('inventory', record.target_store_id);
                // Add notification for the current store
                addNotification('store', storeId);
                
                message.success('Item sent to inventory successfully');
                fetchOutboundItems();
            }
        } catch (error) {
            message.error(error.message || 'Failed to send item to inventory');
        }
    };

    return (
        <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Search
                        placeholder="Search outbound items..."
                        allowClear
                        enterButton={<SearchOutlined />}
                        onSearch={handleSearch}
                        value={searchText}
                        onChange={(e) => handleSearch(e.target.value)}
                        style={{ width: '100%' }}
                    />
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Search
                        placeholder="Enter serial number to add..."
                        allowClear
                        enterButton="Add"
                        onSearch={handleAddItem}
                        value={addSerialNumber}
                        onChange={(e) => setAddSerialNumber(e.target.value)}
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
                        onChange={handleStoreChange}
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
                dataSource={searchText ? filteredRecords : records}
                rowKey="id"
                loading={loading}
                scroll={{ x: 1500 }}
                rowClassName={getRowClassName}
                onRow={(record) => ({
                    style: {}
                })}
                pagination={{
                    total: (searchText ? filteredRecords : records).length,
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