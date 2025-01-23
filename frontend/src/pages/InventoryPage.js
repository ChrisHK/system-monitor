import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { Table, Input, Button, message, Popconfirm, Space, Tag, Row, Col, Select, Card, Modal, Form, Statistic } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { 
    getInventoryRecords, 
    getDuplicateRecords, 
    updateRecord,
    deleteRecord,
    searchRecords,
    addToOutbound,
    removeFromOutbound,
    sendToStore,
    getOutboundItems,
    storeApi,
    checkItemLocation
} from '../services/api';
import { useNotification } from '../contexts/NotificationContext';

const { Search } = Input;
const { Option } = Select;

const InventoryPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { "*": storeId } = useParams();
    const { user, logout } = useAuth();
    const [loading, setLoading] = useState(false);
    const [records, setRecords] = useState([]);
    const [duplicateSerials, setDuplicateSerials] = useState(new Set());
    const [searchText, setSearchText] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [totalItems, setTotalItems] = useState(0);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [form] = Form.useForm();
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 20,
        total: 0
    });
    const [outboundModalVisible, setOutboundModalVisible] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [storesList, setStoresList] = useState([]);
    const isFirstMount = useRef(true);
    const { addNotification } = useNotification();

    // 檢查用戶是否有 outbound 權限
    const hasOutboundPermission = useMemo(() => {
        return user?.group_name === 'admin' || 
            user?.group_permissions?.main_permissions?.outbound === true;
    }, [user]);

    useEffect(() => {
        const path = location.pathname;
        if (path.startsWith('/stores/')) {
            const id = parseInt(path.split('/')[2], 10);
            if (!isNaN(id)) {
                setSelectedBranch(id);
            } else {
                setSelectedBranch('all');
            }
        } else {
            setSelectedBranch('all');
        }
    }, [location.pathname]);

    // 只在組件初始化時獲取一次 duplicates
    useEffect(() => {
        const fetchDuplicates = async () => {
            try {
                const duplicatesResponse = await getDuplicateRecords();
                if (duplicatesResponse?.success) {
                    const duplicatesList = duplicatesResponse.duplicates.map(d => d.serialnumber);
                    setDuplicateSerials(new Set(duplicatesList));
                }
            } catch (error) {
                console.error('Failed to fetch duplicates:', error);
                setDuplicateSerials(new Set());
            }
        };

        if (isInitialLoad) {
            fetchDuplicates();
            setIsInitialLoad(false);
        }
    }, [isInitialLoad]);

    const handleSessionExpired = useCallback(() => {
        message.error('Session expired. Please login again.');
        logout();
        navigate('/login');
    }, [logout, navigate]);

    const fetchRecords = useCallback(async () => {
        if (loading) return; // Prevent concurrent fetches
        
        try {
            setLoading(true);
            const searchParams = {
                page: pagination.current,
                limit: pagination.pageSize,
                ...(storeId && storeId !== 'all' ? { store_id: parseInt(storeId, 10) } : {})
            };

            console.log('Fetching records with params:', searchParams);
            
            const response = searchText ? 
                await searchRecords(searchText, searchParams) :
                await getInventoryRecords(searchParams);
            
            if (response?.success) {
                let processedRecords = [];
                try {
                    // Check locations for each item individually
                    const locationChecks = await Promise.all(
                        response.records.map(async record => {
                            try {
                                const locationResponse = await checkItemLocation(record.serialnumber);
                                return {
                                    serialnumber: record.serialnumber,
                                    locationInfo: locationResponse?.success ? {
                                        store_id: locationResponse.location?.store_id,
                                        store_name: locationResponse.location?.store_name,
                                        location_type: locationResponse.location?.location
                                    } : null
                                };
                            } catch (error) {
                                console.warn(`Failed to check location for ${record.serialnumber}:`, error);
                                return {
                                    serialnumber: record.serialnumber,
                                    locationInfo: null
                                };
                            }
                        })
                    );

                    // Create location map from individual checks
                    const locationMap = new Map(
                        locationChecks.map(check => [
                            check.serialnumber,
                            check.locationInfo
                        ])
                    );

                    processedRecords = (response.records || []).map(record => {
                        const locationInfo = locationMap.get(record.serialnumber);
                        
                        // If we have location info from the API
                        if (locationInfo) {
                            // Handle store location
                            if (locationInfo.location_type === 'store') {
                                return {
                                    ...record,
                                    location: locationInfo.store_name,
                                    locationColor: 'blue'
                                };
                            }
                            // Handle outbound location
                            if (locationInfo.location_type === 'outbound') {
                                return {
                                    ...record,
                                    location: 'Outbound',
                                    locationColor: 'orange'
                                };
                            }
                        }
                        
                        // If the record has store_id/store_name from the original data
                        if (record.store_id && record.store_name) {
                            return {
                                ...record,
                                location: record.store_name,
                                locationColor: 'blue'
                            };
                        }
                        
                        // Default to Inventory if no location info is available
                        return {
                            ...record,
                            location: 'Inventory',
                            locationColor: 'green'
                        };
                    });
                } catch (locationError) {
                    console.warn('Failed to check locations, falling back to record data:', locationError);
                    // Fall back to using store information from the records
                    processedRecords = (response.records || []).map(record => ({
                        ...record,
                        location: record.store_id ? {
                            storeName: record.store_name || storesList.find(s => s.value === record.store_id)?.label,
                            color: 'blue'
                        } : {
                            storeName: 'Inventory',
                            color: 'green'
                        }
                    }));
                }

                setRecords(processedRecords);
                setFilteredRecords(processedRecords);
                setTotalRecords(response.total || 0);
                setTotalItems(response.totalItems || response.total || 0);
                setPagination(prev => ({
                    ...prev,
                    total: response.total || 0
                }));
            } else {
                console.error('API request succeeded but response indicates failure:', response);
                message.error('Failed to load inventory data');
            }
        } catch (error) {
            console.error('Failed to fetch records:', error);
            if (error.response?.status === 401) {
                handleSessionExpired();
            } else {
                message.error('Failed to load inventory data: ' + (error.response?.data?.message || error.message));
            }
        } finally {
            setLoading(false);
        }
    }, [pagination.current, pagination.pageSize, storeId, handleSessionExpired, searchText, loading, storesList]);

    // Handle pagination changes
    const handleTableChange = useCallback((newPagination, filters, sorter) => {
        setPagination(prev => ({
            ...prev,
            current: newPagination.current,
            pageSize: newPagination.pageSize
        }));
    }, []);

    // Combined effect for data fetching
    useEffect(() => {
        const fetchData = async () => {
            // Skip if it's not the initial load and we're already loading
            if (!isFirstMount.current && loading) return;
            
            // If it's the first mount, mark it as done
            if (isFirstMount.current) {
                isFirstMount.current = false;
            }

            // Add debounce for search and pagination changes
            const timer = setTimeout(() => {
                fetchRecords();
            }, searchText ? 300 : 0); // Only debounce for search

            return () => clearTimeout(timer);
        };

        fetchData();
    }, [pagination.current, pagination.pageSize, storeId, searchText]);

    // Handle search
    const handleSearch = useCallback((value) => {
        setSearchText(value);
        setPagination(prev => ({
            ...prev,
            current: 1 // Reset to first page on new search
        }));
    }, []);

    const handleEdit = useCallback((record) => {
        setEditingRecord(record);
        form.setFieldsValue(record);
        setEditModalVisible(true);
    }, [form]);

    const handleDelete = useCallback(async (recordId) => {
        if (!recordId) {
            message.error('Invalid record to delete');
            return;
        }

        try {
            const response = await deleteRecord(recordId);
            if (response.data.success) {
                message.success('Record deleted successfully');
                fetchRecords();
            }
        } catch (error) {
            console.error('Delete failed:', error);
            message.error('Failed to delete record');
        }
    }, [fetchRecords]);

    const handleEditSubmit = async () => {
        try {
            const values = await form.validateFields();
            const response = await updateRecord(editingRecord.id, values);
            if (response.data.success) {
                message.success('Record updated successfully');
                setEditModalVisible(false);
                fetchRecords();
            }
        } catch (error) {
            console.error('Update failed:', error);
            message.error('Failed to update record');
        }
    };

    const fetchStores = useCallback(async () => {
        try {
            const response = await storeApi.getStores();
            if (response?.success) {
                const stores = response.stores.map(store => ({
                    value: store.id,
                    label: store.name
                }));
                setStoresList(stores);
            }
        } catch (error) {
            console.error('Error fetching stores:', error);
            message.error('Failed to load stores');
        }
    }, []);

    useEffect(() => {
        fetchStores();
    }, [fetchStores]);

    const OutboundModal = () => {
        const [outboundRecords, setOutboundRecords] = useState([]);
        const [outboundLoading, setOutboundLoading] = useState(false);
        const [selectedStore, setSelectedStore] = useState(null);
        const [addSerialNumber, setAddSerialNumber] = useState('');
        const [isOutboundInitialized, setIsOutboundInitialized] = useState(false);

        const handleRemoveItem = async (itemId) => {
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
                console.error('Remove item error:', error);
                message.error(error.message || 'Failed to remove item');
            } finally {
                setOutboundLoading(false);
            }
        };

        const handleAddItem = async (serialNumber) => {
            if (!serialNumber) return;
            try {
                setOutboundLoading(true);
                const searchResponse = await searchRecords(serialNumber);
                if (searchResponse?.success && searchResponse.records?.length > 0) {
                    const record = searchResponse.records[0];
                    const addResponse = await addToOutbound(record.id);
                    if (addResponse?.success) {
                        message.success('Item added to outbound successfully');
                        await fetchOutboundItems();
                        setAddSerialNumber('');
                    } else {
                        throw new Error(addResponse?.error || 'Failed to add item to outbound');
                    }
                } else {
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
                setOutboundLoading(false);
                setAddSerialNumber('');
            }
        };

        const handleSendToStore = async () => {
            if (!selectedStore) {
                message.error('Please select a store first');
                return;
            }

            try {
                setOutboundLoading(true);
                const selectedStoreData = storesList.find(s => s.value === selectedStore);
                if (!selectedStoreData) {
                    throw new Error('Store not found');
                }

                const outboundIds = outboundRecords.map(r => r.outbound_item_id).filter(Boolean);
                if (outboundIds.length === 0) {
                    throw new Error('No valid outbound items found');
                }

                console.log('Sending items to store:', {
                    storeId: selectedStore,
                    outboundIds,
                    storeName: selectedStoreData.label
                });

                const response = await sendToStore(selectedStore, outboundIds);
                if (response?.success) {
                    message.success(`Successfully sent items to ${selectedStoreData.label}`);
                    // Add notification for target store's inventory
                    addNotification('inventory', selectedStore);
                    await fetchOutboundItems();
                    fetchRecords();
                    setOutboundModalVisible(false);
                } else if (response?.error?.includes('already in stores:')) {
                    Modal.confirm({
                        title: 'Items Already in Store',
                        content: `${response.error}\n\nDo you want to move these items to ${selectedStoreData.label}?`,
                        onOk: async () => {
                            try {
                                const retryResponse = await sendToStore(selectedStore, outboundIds, true);
                                if (retryResponse?.success) {
                                    message.success('Items moved to new store successfully');
                                    // Add notification for target store's inventory when moving items
                                    addNotification('inventory', selectedStore);
                                    await fetchOutboundItems();
                                    fetchRecords();
                                    setOutboundModalVisible(false);
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

        const fetchOutboundItems = async () => {
            if (!outboundModalVisible) return;
            
            try {
                setOutboundLoading(true);
                const response = await getOutboundItems();
                if (response?.items) {
                    setOutboundRecords(response.items);
                }
            } catch (error) {
                message.error('Failed to fetch outbound items');
            } finally {
                setOutboundLoading(false);
            }
        };

        useEffect(() => {
            if (!isOutboundInitialized) {
                fetchOutboundItems();
                setIsOutboundInitialized(true);
            }
        }, [isOutboundInitialized]);

        useEffect(() => {
            return () => {
                setIsOutboundInitialized(false);
            };
        }, []);

        return (
            <>
                <Row gutter={[16, 16]}>
                    <Col span={8}>
                        <Search
                            placeholder="Enter serial number to add..."
                            allowClear
                            enterButton="Add"
                            value={addSerialNumber}
                            onChange={(e) => setAddSerialNumber(e.target.value)}
                            onSearch={handleAddItem}
                        />
                    </Col>
                    <Col span={8}>
                        <Select
                            style={{ width: '100%' }}
                            placeholder="Select store"
                            value={selectedStore}
                            onChange={setSelectedStore}
                        >
                            {storesList.map(store => (
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
                            disabled={!selectedStore || outboundRecords.length === 0}
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
                                    onClick={() => handleRemoveItem(record.outbound_item_id)}
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
                />
            </>
        );
    };

    const columns = useMemo(() => [
        {
            title: 'Location',
            dataIndex: 'location',
            key: 'location',
            width: 120,
            render: (location, record) => {
                const displayLocation = typeof location === 'string' ? location : 'Inventory';
                const color = record.locationColor || 'green';
                
                return (
                    <Tag color={color} style={{ minWidth: '80px', textAlign: 'center' }}>
                        {displayLocation}
                    </Tag>
                );
            }
        },
        {
            title: 'Serial Number',
            dataIndex: 'serialnumber',
            key: 'serialnumber',
            width: 150,
            filterable: true,
            render: (text) => (
                <span>
                    {text}
                    {duplicateSerials.has(text) && (
                        <Tag color="red" style={{ marginLeft: 8 }}>
                            Duplicate
                        </Tag>
                    )}
                </span>
            ),
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
                <Space size="middle">
                    <Button type="link" onClick={() => handleEdit(record)}>
                        Edit
                    </Button>
                    {duplicateSerials.has(record.serialnumber) && (
                        <Popconfirm
                            title="Delete this record?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Yes"
                            cancelText="No"
                        >
                            <Button danger type="link">Delete</Button>
                        </Popconfirm>
                    )}
                </Space>
            )
        }
    ], [duplicateSerials, handleDelete, handleEdit]);

    return (
        <div>
            <Row gutter={[16, 16]} className="stats-row">
                <Col span={8}>
                    <Card>
                        <Statistic 
                            title="Inventory Items" 
                            value={totalRecords || 0}
                        />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic 
                            title="Total Items" 
                            value={totalItems || 0}
                        />
                    </Card>
                </Col>
            </Row>

            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col span={24}>
                    <Card>
                        <Row gutter={16}>
                            <Col span={24}>
                                <Space>
                                    <Select
                                        style={{ width: 200 }}
                                        value={selectedBranch}
                                        onChange={setSelectedBranch}
                                    >
                                        <Option value="all">All Stores</Option>
                                        {storesList.map(store => (
                                            <Option key={store.value} value={store.value}>
                                                {store.label}
                                            </Option>
                                        ))}
                                    </Select>
                                    <Search
                                        placeholder="Search records..."
                                        allowClear
                                        enterButton={<SearchOutlined />}
                                        onSearch={handleSearch}
                                        style={{ width: 300 }}
                                    />
                                    {hasOutboundPermission && (
                                        <Button
                                            type="primary"
                                            onClick={() => setOutboundModalVisible(true)}
                                        >
                                            Outbound
                                        </Button>
                                    )}
                                    <Button
                                        icon={<ReloadOutlined />}
                                        onClick={() => fetchRecords(pagination.current, pagination.pageSize)}
                                        loading={loading}
                                    >
                                        Refresh
                                    </Button>
                                </Space>
                            </Col>
                        </Row>
                    </Card>
                </Col>

                <Col span={24}>
                    <Table
                        columns={columns}
                        dataSource={filteredRecords}
                        rowKey="id"
                        loading={loading}
                        scroll={{ x: 1500 }}
                        pagination={{
                            ...pagination,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            pageSizeOptions: ['20', '50', '100']
                        }}
                        onChange={handleTableChange}
                        summary={pageData => {
                            return (
                                <Table.Summary fixed>
                                    <Table.Summary.Row>
                                        <Table.Summary.Cell index={0} colSpan={columns.length}>
                                            Total Records: {totalRecords}
                                        </Table.Summary.Cell>
                                    </Table.Summary.Row>
                                </Table.Summary>
                            );
                        }}
                    />
                </Col>
            </Row>

            <Modal
                title="Edit Record"
                open={editModalVisible}
                onOk={handleEditSubmit}
                onCancel={() => {
                    setEditModalVisible(false);
                    form.resetFields();
                }}
            >
                <Form
                    form={form}
                    layout="vertical"
                >
                    <Form.Item
                        name="serialnumber"
                        label="Serial Number"
                        rules={[{ required: true, message: 'Please input serial number!' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="computername"
                        label="Computer Name"
                        rules={[{ required: true, message: 'Please input computer name!' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="manufacturer"
                        label="Manufacturer"
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="model"
                        label="Model"
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="systemsku"
                        label="System SKU"
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="operatingsystem"
                        label="Operating System"
                    >
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title="Outbound Management"
                open={outboundModalVisible}
                onCancel={() => setOutboundModalVisible(false)}
                width={1000}
                footer={null}
            >
                <OutboundModal />
            </Modal>
        </div>
    );
};

export default InventoryPage; 