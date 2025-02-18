import React, { useState, useEffect, useCallback } from 'react';
import { 
    Table, 
    Input, 
    Button, 
    message, 
    Row, 
    Col, 
    Select, 
    Tag, 
    Alert, 
    Space,
    Tooltip,
    Modal
} from 'antd';
import { 
    SearchOutlined, 
    ReloadOutlined, 
    DeleteOutlined, 
    SendOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons';
import { inventoryService, storeService } from '../api';
import { useNotification } from '../contexts/NotificationContext';
import moment from 'moment';

const { Search } = Input;
const { Option } = Select;
const { confirm } = Modal;

const OutboundPage = () => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searchText, setSearchText] = useState('');
    const [addSerialNumber, setAddSerialNumber] = useState('');
    const [selectedStore, setSelectedStore] = useState(null);
    const [stores, setStores] = useState([]);
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [itemLocations, setItemLocations] = useState({});
    const { addNotification } = useNotification();

    const fetchStores = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await storeService.getStores();
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to load stores');
            }
            
            const stores = response.data?.stores || response.stores;
            if (!Array.isArray(stores)) {
                throw new Error('Invalid stores data format');
            }
            
            setStores(stores);
        } catch (error) {
            console.error('Error fetching stores:', error);
            setError(error.message || 'Failed to load stores');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStores();
    }, []);

    const columns = [
        {
            title: 'Location',
            dataIndex: 'serialnumber',
            key: 'location',
            width: 120,
            fixed: 'left',
            render: (serialnumber) => {
                const location = itemLocations[serialnumber];
                if (!location) {
                    return <Tag color="default">Unknown</Tag>;
                }
                if (location.location === 'store') {
                    return (
                        <Tooltip title={`Store: ${location.store_name || 'Unknown'}`}>
                            <Tag color="blue" style={{ minWidth: '80px', textAlign: 'center' }}>
                                {location.store_name || 'Store'}
                            </Tag>
                        </Tooltip>
                    );
                }
                if (location.location === 'inventory') {
                    return (
                        <Tooltip title="Main Inventory">
                            <Tag color="green" style={{ minWidth: '80px', textAlign: 'center' }}>
                                Inventory
                            </Tag>
                        </Tooltip>
                    );
                }
                return (
                    <Tooltip title={`Location: ${location.location || 'Unknown'}`}>
                        <Tag color="default" style={{ minWidth: '80px', textAlign: 'center' }}>
                            {location.location || 'Unknown'}
                        </Tag>
                    </Tooltip>
                );
            }
        },
        {
            title: 'Serial Number',
            dataIndex: 'serialnumber',
            key: 'serialnumber',
            width: 200,
            fixed: 'left'
        },
        {
            title: 'Computer Name',
            dataIndex: 'computername',
            key: 'computername',
            width: 150
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
                return health ? (
                    <Tooltip title={`Battery Health: ${health}%`}>
                        <Tag color={color}>{health}%</Tag>
                    </Tooltip>
                ) : 'N/A';
            }
        },
        {
            title: 'Created Time',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 150,
            render: (text) => {
                if (!text) return 'N/A';
                return moment(text).format('YYYY-MM-DD HH:mm:ss');
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 100,
            render: (_, record) => (
                <Space>
                    <Tooltip title="Remove from Outbound">
                        <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveItem(record.outbound_item_id)}
                            disabled={loading}
                        />
                    </Tooltip>
                </Space>
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
            setError('');
            
            // Search for record in inventory
            const response = await inventoryService.searchRecords(searchValue);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to search records');
            }
            
            const records = response.records;
            
            // Check locations for found records
            const locationPromises = records.map(record => 
                inventoryService.checkItemLocation(record.serialnumber)
                    .catch(error => {
                        console.warn(`Failed to check location for ${record.serialnumber}:`, error);
                        return { success: true, location: 'unknown' };
                    })
            );
            
            const locations = await Promise.all(locationPromises);
            
            // Update locations state
            const newLocations = {};
            locations.forEach((locationResponse, index) => {
                if (locationResponse?.success) {
                    newLocations[records[index].serialnumber] = locationResponse.data;
                }
            });
            
            setItemLocations(prev => ({ ...prev, ...newLocations }));
            setFilteredRecords(records);
        } catch (error) {
            console.error('Error searching records:', error);
            setError(error.message || 'Failed to search records');
            setFilteredRecords([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleRemoveItem = async (itemId) => {
        try {
            confirm({
                title: 'Remove Item',
                icon: <ExclamationCircleOutlined />,
                content: 'Are you sure you want to remove this item from outbound?',
                okText: 'Yes',
                okType: 'danger',
                cancelText: 'No',
                onOk: async () => {
                    setLoading(true);
                    setError('');
                    const response = await inventoryService.removeFromOutbound(itemId);
                    
                    if (!response?.success) {
                        throw new Error(response?.error || 'Failed to remove item');
                    }
                    
                    message.success('Item removed successfully');
                    await fetchOutboundItems();
                }
            });
        } catch (error) {
            console.error('Error removing item:', error);
            setError(error.message || 'Failed to remove item');
        } finally {
            setLoading(false);
        }
    };

    const handleSendToStore = async () => {
        if (!selectedStore) {
            message.error('Please select a store');
            return;
        }

        try {
            setLoading(true);
            setError('');
            const response = await inventoryService.sendToStore(selectedStore);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to send items to store');
            }
            
            message.success('Items sent to store successfully');
            addNotification('store', selectedStore);
            await fetchOutboundItems();
            setSelectedStore(null);
        } catch (error) {
            console.error('Error sending to store:', error);
            setError(error.message || 'Failed to send items to store');
        } finally {
            setLoading(false);
        }
    };

    const fetchOutboundItems = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await inventoryService.getOutboundItems();
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to load outbound items');
            }
            
            setRecords(response.items);
        } catch (error) {
            console.error('Error fetching outbound items:', error);
            setError(error.message || 'Failed to load outbound items');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOutboundItems();
    }, []);

    const handleAddItem = async () => {
        if (!addSerialNumber.trim()) {
            message.error('Please enter a serial number');
            return;
        }

        try {
            setLoading(true);
            setError('');
            const response = await inventoryService.addToOutbound(addSerialNumber.trim());
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to add item to outbound');
            }
            
            message.success('Item added to outbound successfully');
            setAddSerialNumber('');
            await fetchOutboundItems();
        } catch (error) {
            console.error('Error adding item:', error);
            setError(error.message || 'Failed to add item to outbound');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '24px' }}>
            <Row gutter={[16, 16]}>
                <Col span={24}>
                    <Space size="middle">
                        <Search
                            placeholder="Search inventory by serial number"
                            allowClear
                            enterButton={<SearchOutlined />}
                            onSearch={handleSearch}
                            style={{ width: 300 }}
                            disabled={loading}
                        />
                        <Input
                            placeholder="Add item by serial number"
                            value={addSerialNumber}
                            onChange={(e) => setAddSerialNumber(e.target.value)}
                            style={{ width: 200 }}
                            disabled={loading}
                        />
                        <Button
                            type="primary"
                            onClick={handleAddItem}
                            disabled={!addSerialNumber.trim() || loading}
                            icon={<SendOutlined />}
                        >
                            Add to Outbound
                        </Button>
                        <Select
                            placeholder="Select store"
                            style={{ width: 200 }}
                            value={selectedStore}
                            onChange={setSelectedStore}
                            disabled={loading || !records.length}
                        >
                            {stores.map(store => (
                                <Option key={store.id} value={store.id}>
                                    {store.name}
                                </Option>
                            ))}
                        </Select>
                        <Button
                            type="primary"
                            onClick={handleSendToStore}
                            disabled={!selectedStore || !records.length || loading}
                            icon={<SendOutlined />}
                        >
                            Send to Store
                        </Button>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={fetchOutboundItems}
                            disabled={loading}
                        >
                            Refresh
                        </Button>
                    </Space>
                </Col>

                {error && (
                    <Col span={24}>
                        <Alert
                            message="Error"
                            description={error}
                            type="error"
                            showIcon
                            closable
                            onClose={() => setError('')}
                        />
                    </Col>
                )}

                <Col span={24}>
                    <Table
                        columns={columns}
                        dataSource={searchText ? filteredRecords : records}
                        rowKey="serialnumber"
                        loading={loading}
                        scroll={{ x: 2000 }}
                        pagination={{
                            showSizeChanger: true,
                            showQuickJumper: true,
                            pageSizeOptions: ['10', '20', '50', '100'],
                            showTotal: (total) => `Total ${total} records`
                        }}
                    />
                </Col>
            </Row>
        </div>
    );
};

export default OutboundPage; 