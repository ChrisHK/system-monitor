import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Table, message, Row, Col, Card, Statistic, Button, Input, Space, Tag } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { storeDataService } from '../services/storeDataService';
import { checkItemLocation } from '../services/api';

const { Search } = Input;

// Utility functions
const formatDate = (text) => {
    if (!text) return 'N/A';
    return new Date(text).toLocaleString();
};

const formatSystemSku = (text) => {
    if (!text) return 'N/A';
    const parts = text.split('_');
    const thinkpadPart = parts.find(part => part.includes('ThinkPad'));
    if (thinkpadPart) {
        return parts.slice(parts.indexOf(thinkpadPart)).join(' ')
            .replace(/Gen (\d+)$/, 'Gen$1').trim();
    }
    return text;
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
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [itemLocations, setItemLocations] = useState({});

    const fetchStoreData = useCallback(async () => {
        if (!user || !storeId) return;

        try {
            setLoading(true);
            const storeDetails = await storeDataService.getStoreDetails(storeId);
            setStore(storeDetails);

            const itemsResponse = await storeDataService.getStoreItems(storeId);
            if (itemsResponse?.items) {
                const items = itemsResponse.items;
                setRecords(items);

                // Fetch locations for all items
                const locationPromises = items.map(item => 
                    checkItemLocation(item.serialnumber)
                        .then(location => [item.serialnumber, location])
                        .catch(() => [item.serialnumber, { location: 'inventory' }])
                );

                const locations = await Promise.all(locationPromises);
                const locationMap = Object.fromEntries(locations);
                setItemLocations(locationMap);
            }
        } catch (error) {
            if (error.response?.status === 404) {
                message.error('Store not found');
                navigate('/inventory');
            } else {
                message.error('Failed to load store data');
            }
        } finally {
            setLoading(false);
        }
    }, [storeId, user, navigate]);

    useEffect(() => {
        if (!user) return;
        
        const userStoreId = user.store_id?.toString();
        const requestedStoreId = storeId?.toString();

        if (user.role !== 'admin' && userStoreId !== requestedStoreId) {
            message.error('Access denied');
            navigate('/inventory');
            return;
        }

        fetchStoreData();
    }, [user, storeId, navigate, fetchStoreData]);

    const handleSearch = (value) => {
        setSearchText(value);
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

    const columns = [
        {
            title: 'Location',
            dataIndex: 'serialnumber',
            key: 'location',
            width: 120,
            render: (serialnumber) => {
                const location = itemLocations[serialnumber];
                if (!location) {
                    return <Tag color="default" style={{ minWidth: '80px', textAlign: 'center' }}>Unknown</Tag>;
                }
                if (location.location === 'store') {
                    return (
                        <Tag color="blue" style={{ minWidth: '80px', textAlign: 'center' }}>
                            {location.store_name || store?.name || 'Store'}
                        </Tag>
                    );
                }
                return (
                    <Tag color="green" style={{ minWidth: '80px', textAlign: 'center' }}>
                        Inventory
                    </Tag>
                );
            }
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

    return (
        <div className="page-container">
            <Row gutter={[16, 16]} className="header-row">
                <Col span={16}>
                    <h1>{store?.name || 'Store'} Inventory</h1>
                </Col>
                <Col span={8} style={{ textAlign: 'right' }}>
                    <Space>
                        <Button 
                            type="primary" 
                            icon={<ReloadOutlined />}
                            onClick={handleRefresh}
                            loading={loading}
                        >
                            Refresh
                        </Button>
                    </Space>
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

            <Row gutter={[16, 16]} className="content-row">
                <Col span={24}>
                    <Card>
                        <div className="table-header">
                            <Space style={{ marginBottom: 16 }}>
                                <Search
                                    placeholder="Search by serial number, computer name, or model"
                                    allowClear
                                    enterButton={<SearchOutlined />}
                                    onSearch={handleSearch}
                                    style={{ width: 400 }}
                                />
                            </Space>
                        </div>
                        <Table
                            columns={columns}
                            dataSource={searchText ? filteredRecords : records}
                            rowKey="serialnumber"
                            loading={loading}
                            scroll={{ x: true }}
                            pagination={{
                                total: (searchText ? filteredRecords : records).length,
                                pageSize: 20,
                                showSizeChanger: true,
                                pageSizeOptions: ['20', '50', '100'],
                                showTotal: (total) => `Total ${total} items`
                            }}
                        />
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default StorePage; 