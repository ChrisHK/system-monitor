import React, { useState, useEffect, useCallback } from 'react';
import { Table, Input, Button, message, Row, Col, Select, Tag, Modal } from 'antd';
import { SearchOutlined, ReloadOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons';
import { searchRecords, addToOutbound, getOutboundItems, removeFromOutbound, sendToStore, getStores, checkStoreItems, checkItemLocation } from '../services/api';

const { Search } = Input;
const { Option } = Select;

// Add styles object
const styles = {
    duplicateRow: {
        backgroundColor: '#fff1f0'
    },
    duplicateRowHover: {
        backgroundColor: '#ffccc7'
    }
};

const OutboundPage = () => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedStore, setSelectedStore] = useState(null);
    const [stores, setStores] = useState([]);
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [duplicateItems, setDuplicateItems] = useState([]);
    const [addSerialNumber, setAddSerialNumber] = useState('');
    const [itemLocations, setItemLocations] = useState({});

    const columns = [
        {
            title: 'Location',
            dataIndex: 'serialnumber',
            key: 'location',
            width: 120,
            render: (text) => {
                const location = itemLocations[text];
                if (!location) return <Tag color="default">Unknown</Tag>;
                if (location.location === 'store') {
                    return (
                        <Tag color="blue" style={{ minWidth: '80px', textAlign: 'center' }}>
                            {location.storeName}
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
                        None
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
            // Search for record
            const response = await searchRecords('serialnumber', searchValue);
            
            if (response.success && response.records.length > 0) {
                const record = response.records[0];
                
                // Check item location
                const locationResponse = await checkItemLocation(record.serialnumber);
                
                if (locationResponse.success) {
                    setItemLocations(prev => ({
                        ...prev,
                        [record.serialnumber]: locationResponse
                    }));
                }
                
                setFilteredRecords([record]);
            } else {
                message.warning('No record found with this serial number');
                setFilteredRecords([]);
            }
        } catch (error) {
            message.error(`Search failed: ${error.message}`);
            setFilteredRecords([]);
        }
    }, []);

    const fetchOutboundItems = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getOutboundItems();
            console.log('Fetched outbound items:', response);

            if (response.success) {
                const items = response.items || [];
                setRecords(items);

                // Check location for each item
                const locationPromises = items.map(async (item) => {
                    if (!item.serialnumber) {
                        console.warn('Item missing serial number:', item);
                        return null;
                    }

                    try {
                        const locationResponse = await checkItemLocation(item.serialnumber);
                        console.log(`Location for ${item.serialnumber}:`, locationResponse);
                        
                        if (locationResponse.success) {
                            return {
                                serialNumber: item.serialnumber,
                                location: locationResponse
                            };
                        } else {
                            console.warn(`Failed to get location for ${item.serialnumber}:`, locationResponse);
                        }
                    } catch (error) {
                        console.error(`Error checking location for ${item.serialnumber}:`, error);
                    }
                    return null;
                });

                const locations = await Promise.all(locationPromises);
                console.log('All locations:', locations);

                const locationMap = {};
                locations.forEach(loc => {
                    if (loc) {
                        locationMap[loc.serialNumber] = loc.location;
                    }
                });
                console.log('Location map:', locationMap);
                setItemLocations(locationMap);
            } else {
                console.warn('Failed to fetch outbound items:', response);
            }
        } catch (error) {
            console.error('Error in fetchOutboundItems:', error);
            message.error(`Failed to fetch items: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchStores = useCallback(async () => {
        try {
            const response = await getStores();
            if (response.success) {
                setStores(response.stores.map(store => ({
                    value: store.id,
                    label: store.name
                })));
            }
        } catch (error) {
            message.error(`Failed to fetch stores: ${error.message}`);
        }
    }, []);

    // Effect for initial data fetch
    useEffect(() => {
        fetchOutboundItems();
        fetchStores();
    }, [fetchOutboundItems, fetchStores]);

    const handleStoreChange = useCallback((value) => {
        setSelectedStore(value);
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
            message.warning('Please select a store first');
            return;
        }

        if (records.length === 0) {
            message.warning('No items to send');
            return;
        }

        try {
            setLoading(true);
            
            // First check for duplicates and current locations
            const serialNumbers = records.map(record => record.serialnumber);
            const checkResponse = await checkStoreItems(selectedStore, serialNumbers);

            if (checkResponse.duplicates.length > 0) {
                const duplicates = checkResponse.duplicates;
                setDuplicateItems(duplicates.map(d => d.serialNumber));
                
                const duplicateMessages = duplicates.map(d => 
                    `Serial Number ${d.serialNumber} already exists in ${d.storeName}`
                );
                
                Modal.confirm({
                    title: 'Transfer Items',
                    content: (
                        <div>
                            <p>The following items will be transferred:</p>
                            <ul>
                                {duplicateMessages.map((msg, idx) => (
                                    <li key={idx}>{msg}</li>
                                ))}
                            </ul>
                            <p>Existing items will be removed from their current stores.</p>
                            <p>Do you want to proceed?</p>
                        </div>
                    ),
                    onOk: () => proceedWithSend(),
                    onCancel: () => {
                        setLoading(false);
                    },
                });
                return;
            }

            await proceedWithSend();
        } catch (error) {
            message.error(error.message);
            setLoading(false);
        }
    };

    const proceedWithSend = async () => {
        try {
            const itemIds = records.map(record => record.outbound_item_id);
            const response = await sendToStore(selectedStore, itemIds);

            if (response.success) {
                message.success('Items sent to store successfully');
                await fetchOutboundItems();
                setSelectedStore(null);
                setDuplicateItems([]);
            }
        } catch (error) {
            message.error(error.message);
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
                setAddSerialNumber(''); // Clear input on duplicate
                return;
            }

            // Search for record by serial number
            const response = await searchRecords('serialnumber', serialNumber);

            if (response.success && response.records.length > 0) {
                const record = response.records[0];
                
                try {
                    // Add record to outbound
                    const addResponse = await addToOutbound(record.id);

                    if (addResponse.success) {
                        message.success('Item added to outbound successfully');
                        await fetchOutboundItems();
                        setAddSerialNumber(''); // Clear input on success
                    }
                } catch (error) {
                    // Handle specific error for duplicate items
                    if (error.message.includes('already in outbound')) {
                        message.warning(`Serial Number ${serialNumber} is already in the outbound list`);
                        setAddSerialNumber(''); // Clear input on duplicate
                    } else {
                        message.error(`Failed to add item: ${error.message}`);
                    }
                }
            } else {
                message.warning('No record found with this serial number');
                setAddSerialNumber(''); // Clear input when no record found
            }
        } catch (error) {
            message.error(`Failed to add item: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, [records, fetchOutboundItems]);

    // Update the columns definition to include row highlighting
    const getRowClassName = (record) => {
        return duplicateItems.includes(record.serialnumber) ? 'duplicate-row' : '';
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
                    style: duplicateItems.includes(record.serialnumber) ? styles.duplicateRow : {}
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
            
            <style>
                {`
                    .duplicate-row:hover td {
                        background-color: #ffccc7 !important;
                    }
                `}
            </style>
        </div>
    );
};

export default OutboundPage; 