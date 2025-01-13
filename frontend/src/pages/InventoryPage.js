import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Table, 
    Input, 
    Button, 
    message, 
    Space, 
    Tag, 
    Row, 
    Col, 
    Select, 
    Card, 
    Statistic, 
    Modal, 
    Form, 
    Alert 
} from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { inventoryDataService } from '../services/inventoryDataService';

const { Search } = Input;
const { Option } = Select;

// Constants for performance optimization
const INITIAL_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = ['20', '50', '100'];

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

// Update statistics styles
const statisticStyle = {
    fontSize: '24px'
};

// Add modern forced colors mode styles
const tagStyle = {
    minWidth: '80px',
    textAlign: 'center'
};

// Create columns definition
const createColumns = ({ itemLocations, duplicateSerials, handleDelete, handleEdit, userRole }) => [
    {
        title: 'Location',
        dataIndex: 'serialnumber',
        key: 'location',
        width: 120,
        render: (serialnumber) => {
            const location = itemLocations[serialnumber];
            if (!location) {
                return <Tag color="default" style={tagStyle}>Unknown</Tag>;
            }
            if (location.location === 'store') {
                return (
                    <Tag color="blue" style={tagStyle}>
                        {location.store_name || 'Store'}
                    </Tag>
                );
            }
            return (
                <Tag color="green" style={tagStyle}>
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
            filterable: true,
            render: (text) => {
                const isDuplicate = duplicateSerials.has(text);
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {text}
                        {isDuplicate && (
                            <Tag style={tagStyle} color="red">
                                Duplicate
                            </Tag>
                        )}
                    </div>
                );
            }
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
            title: 'Created Time',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 150,
        render: formatDate
    },
];

const InventoryPage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { store } = useParams();

    // State management with performance optimizations
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const refreshTimeoutRef = useRef(null);
    const [records, setRecords] = useState([]);
    const [duplicateSerials, setDuplicateSerials] = useState(new Set());
    const [itemLocations, setItemLocations] = useState({});
    const [stores, setStores] = useState([{ value: 'all', label: 'All Stores' }]);
    const [selectedStore, setSelectedStore] = useState(store || 'all');
    const [searchText, setSearchText] = useState('');
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: INITIAL_PAGE_SIZE,
        total: 0,
    });
    const [editingRecord, setEditingRecord] = useState(null);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [error, setError] = useState(null);

    // Add loading ref to prevent duplicate calls
    const loadingRef = useRef(false);

    // Add request cancellation
    const abortControllerRef = useRef(null);

    // Add loading state for locations
    const loadingLocationsRef = useRef(false);

    // Memoized function for fetching records with debounce and cancellation
    const fetchRecords = useCallback(async () => {
        try {
            console.log('Fetching records...');
            const params = {
                page: pagination.current,
                pageSize: pagination.pageSize,
                store: selectedStore === 'all' ? undefined : selectedStore
            };
            
            const response = await inventoryDataService.getRecords(params);
            console.log('Records response:', response);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to fetch records');
            }

            const records = response.records || [];
            console.log(`Fetched ${records.length} records`);
            
            setRecords(records);
            setPagination(prev => ({
                ...prev,
                total: response.total || records.length
            }));
            
            return { success: true, records };
        } catch (error) {
            console.error('Error fetching records:', error);
            message.error('Failed to load records');
            return { success: false, error: error.message };
        }
    }, [pagination.current, pagination.pageSize, selectedStore]);

    // Track user activity with debounce
    useEffect(() => {
        let activityTimeout;
        const handleActivity = () => {
            if (activityTimeout) {
                clearTimeout(activityTimeout);
            }
            activityTimeout = setTimeout(() => {
                inventoryDataService.updateActivityTime();
            }, 1000); // Debounce for 1 second
        };

        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('click', handleActivity);
        window.addEventListener('scroll', handleActivity);

        // Start background refresh
        inventoryDataService.startBackgroundRefresh();

        // Cleanup
        return () => {
            if (activityTimeout) {
                clearTimeout(activityTimeout);
            }
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('click', handleActivity);
            window.removeEventListener('scroll', handleActivity);
            inventoryDataService.stopBackgroundRefresh();
        };
    }, []);

    // Cleanup refresh timeout
    useEffect(() => {
        return () => {
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
        };
    }, []);

    // Cleanup function for all refs and controllers
    useEffect(() => {
        return () => {
            const controller = abortControllerRef.current;
            if (controller) {
                controller.abort();
            }
            loadingRef.current = false;
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
            abortControllerRef.current = null;
        };
    }, []);

    // Update filtered data with useMemo
    const filteredData = useMemo(() => {
        console.log('Filtering records:', { records, searchText, selectedStore });
        
        if (!Array.isArray(records)) {
            console.log('Records is not an array');
            return { data: [], total: 0 };
        }

        let filtered = [...records];
        console.log('Initial records count:', filtered.length);

        if (searchText) {
            const searchLower = searchText.toLowerCase();
            filtered = filtered.filter(record => 
                Object.entries(record).some(([key, val]) => 
                    ['serialnumber', 'computername', 'manufacturer', 'model', 'systemsku'].includes(key) && 
                    val && 
                    val.toString().toLowerCase().includes(searchLower)
                )
            );
            console.log('After search filter:', filtered.length);
        }

        if (selectedStore !== 'all') {
            const selectedStoreData = stores.find(s => s.value === selectedStore);
            console.log('Selected store:', selectedStoreData);
            
            filtered = filtered.filter(record => {
                const location = itemLocations[record.serialnumber];
                console.log('Record location:', { serialnumber: record.serialnumber, location });
                
                return location?.location === selectedStore || 
                       (location?.location === 'store' && 
                        location?.storeName?.toLowerCase() === selectedStoreData?.name?.toLowerCase());
            });
            console.log('After store filter:', filtered.length);
        }
        
        const result = { 
            data: filtered, 
            total: filtered.length 
        };
        console.log('Final filtered data:', result);
        return result;
    }, [records, searchText, selectedStore, itemLocations, stores]);

    // Memoize pagination values to prevent unnecessary re-renders
    const paginationConfig = useMemo(() => ({
        current: pagination.current,
        pageSize: pagination.pageSize,
        total: filteredData.total,
        showSizeChanger: true,
        showQuickJumper: true,
        pageSizeOptions: PAGE_SIZE_OPTIONS,
        onChange: (page, pageSize) => {
            setPagination(prev => ({
                ...prev,
                current: page,
                pageSize: pageSize
            }));
        }
    }), [pagination, filteredData.total]);

    // Event handlers
    const handleEdit = useCallback((record) => {
        setEditingRecord(record);
        form.setFieldsValue(record);
        setEditModalVisible(true);
    }, [form]);

    const handleDelete = useCallback(async (id) => {
        try {
            const response = await inventoryDataService.deleteRecord(id);
            if (response?.success) {
                message.success('Record deleted successfully');
                fetchRecords();
            } else {
                throw new Error(response?.message || 'Failed to delete record');
            }
        } catch (error) {
            console.error('Error deleting record:', error);
            message.error(error.message || 'Failed to delete record');
        }
    }, [fetchRecords]);

    const handleUpdate = useCallback(async (values) => {
        if (!editingRecord?.id) return;

        try {
            const response = await inventoryDataService.updateRecord(editingRecord.id, values);
            if (response?.success) {
                message.success('Record updated successfully');
                setEditModalVisible(false);
                fetchRecords();
            } else {
                throw new Error(response?.message || 'Failed to update record');
            }
        } catch (error) {
            console.error('Error updating record:', error);
            message.error(error.message || 'Failed to update record');
        }
    }, [editingRecord?.id, fetchRecords]);

    // Memoized store loading function
    const loadStores = useCallback(async () => {
        if (loadingRef.current) {
            console.log('Store loading blocked - already loading');
            return { success: false, error: new Error('Already loading') };
        }
        
        loadingRef.current = true;
        try {
            console.log('Loading stores...');
            const storesResponse = await inventoryDataService.getStores();
            console.log('Stores response:', storesResponse);

            if (!storesResponse?.success) {
                throw new Error(storesResponse?.error || 'Failed to load stores');
            }

            // Log the raw stores data for debugging
            console.log('Raw stores data:', storesResponse.stores);

            const validStores = (storesResponse.stores || [])
                .filter(store => {
                    // Log each store for debugging
                    console.log('Processing store:', store);
                    return store && (store.value || store.id);
                })
                .map(store => ({
                    value: store.value || store.id?.toString(),
                    label: store.label || store.name || 'Unknown Store',
                    id: store.id?.toString()
                }));

            console.log('Valid stores:', validStores);
            
            const updatedStores = [
                { value: 'all', label: 'All Stores' },
                ...validStores
            ];
            
            console.log('Updated stores list:', updatedStores);
            setStores(updatedStores);

            // If current store is invalid, reset to 'all'
            if (store && !validStores.some(s => s.value === store)) {
                console.log('Current store is invalid, resetting to all:', store);
                navigate('/inventory');
            }

            return { success: true, data: validStores };
        } catch (error) {
            console.error('Error loading stores:', error);
            setStores([{ value: 'all', label: 'All Stores' }]);
            return { success: false, error };
        } finally {
            loadingRef.current = false;
        }
    }, [store, navigate]);

    // Add a new function for background location loading with loading state check
    const loadLocationsForCurrentPage = useCallback(async (currentRecords) => {
        if (!currentRecords?.length || loadingLocationsRef.current) return;
        
        try {
            loadingLocationsRef.current = true;
            console.log('Loading locations for current page in background...');
            const locations = await inventoryDataService.batchCheckLocations(currentRecords);
            setItemLocations(prev => ({
                ...prev,
                ...Object.fromEntries(locations)
            }));
        } catch (error) {
            console.error('Error loading locations:', error);
        } finally {
            loadingLocationsRef.current = false;
        }
    }, []);

    // Modify loadInitialData to not load all locations at once
    const loadInitialData = useCallback(async () => {
        try {
            if (!user) {
                console.log('No user, skipping initial load');
                return { success: false, error: 'No user available' };
            }

            console.log('Starting initial data load');
            setLoading(true);
            
            if (loadingRef.current) {
                console.log('Store loading blocked - already loading');
                throw new Error('Store loading already in progress');
            }

            console.log('Loading stores...');
            const storesResponse = await loadStores();
            
            if (!storesResponse?.success) {
                throw new Error(storesResponse?.error || 'Failed to load stores');
            }

            console.log('Loading records...');
            const recordsResponse = await fetchRecords();
            
            if (!recordsResponse?.success) {
                throw new Error(recordsResponse?.error || 'Failed to load records');
            }

            const records = recordsResponse.records || [];
            setRecords(records);

            // Load locations for current page in background
            const currentPageRecords = records.slice(
                (pagination.current - 1) * pagination.pageSize,
                pagination.current * pagination.pageSize
            );
            loadLocationsForCurrentPage(currentPageRecords);

            setLoading(false);
            return { success: true };
        } catch (error) {
            console.error('Initial load error:', error);
            setError(error.message || 'Failed to load initial data');
            setLoading(false);
            return { 
                success: false, 
                error: error.message || 'An unknown error occurred during initial load'
            };
        }
    }, [user, loadStores, fetchRecords, pagination.current, pagination.pageSize, loadLocationsForCurrentPage]);

    // Modify handleRefresh to only load current page locations
    const handleRefresh = useCallback(async () => {
        if (refreshing || loading) return;
        setRefreshing(true);
        try {
            const recordsResponse = await fetchRecords();
            if (recordsResponse?.success) {
                const records = recordsResponse.records || [];
                setRecords(records);
                
                // Load locations for current page in background
                const currentPageRecords = records.slice(
                    (pagination.current - 1) * pagination.pageSize,
                    pagination.current * pagination.pageSize
                );
                loadLocationsForCurrentPage(currentPageRecords);
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
            message.error('Failed to refresh data');
        } finally {
            setRefreshing(false);
        }
    }, [fetchRecords, refreshing, loading, pagination.current, pagination.pageSize, loadLocationsForCurrentPage]);

    // Add effect to load locations when page changes with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            const currentPageRecords = records.slice(
                (pagination.current - 1) * pagination.pageSize,
                pagination.current * pagination.pageSize
            );
            loadLocationsForCurrentPage(currentPageRecords);
        }, 100); // Add small delay to prevent rapid consecutive calls

        return () => clearTimeout(timer);
    }, [pagination.current, pagination.pageSize, records, loadLocationsForCurrentPage]);

    // Handle table interaction with debounce
    const handleTableChange = useCallback((paginationData) => {
        setPagination(prev => ({
            ...prev,
            current: paginationData.current,
            pageSize: paginationData.pageSize
        }));
        inventoryDataService.updateActivityTime();
    }, []);

    // Update the columns definition to handle location rendering
    const columns = useMemo(() => {
        const processedLocations = {};
        Object.entries(itemLocations).forEach(([key, value]) => {
            if (!value) {
                processedLocations[key] = { location: 'unknown' };
            } else if (typeof value === 'string') {
                processedLocations[key] = { location: String(value) };
            } else {
                processedLocations[key] = {
                    location: String(value.location || 'unknown'),
                    storeName: String(value.storeName || '')
                };
            }
        });

        return createColumns({
            itemLocations: processedLocations,
            duplicateSerials,
            handleDelete,
            handleEdit,
            userRole: user?.role
        });
    }, [itemLocations, duplicateSerials, handleDelete, handleEdit, user?.role]);

    // Memoized table props for performance
    const tableProps = useMemo(() => ({
        columns,
        dataSource: filteredData.data,
        rowKey: "id",
        loading,
        scroll: { x: 1500 },
        pagination: paginationConfig,
        onChange: handleTableChange
    }), [
        columns,
        filteredData.data,
        loading,
        paginationConfig,
        handleTableChange
    ]);

    // Add store access control
    useEffect(() => {
        // If user is not admin and tries to access all stores, redirect to their assigned store
        if (user && user.role !== 'admin' && selectedStore === 'all') {
            const userStore = user.store_id;
            if (userStore) {
                setSelectedStore(userStore);
                navigate(`/stores/${userStore}`);
            }
        }
    }, [user, selectedStore, navigate]);

    // Add the renderStoreStatistics function
    const renderStoreStatistics = useCallback(() => {
        const storesList = stores.filter(store => store.value !== 'all');
        if (storesList.length === 0) {
            return null;
        }

        return (
            <Row gutter={16}>
                {storesList.map((store) => {
                    const storeCount = Object.values(itemLocations).reduce((count, location) => {
                        if (!location) return count;
                        if (typeof location === 'string') return count;
                        
                        const storeName = (location.store_name || '').toLowerCase();
                        const storeLabel = (store.label || '').toLowerCase();
                        
                        return (location.location === 'store' && storeName === storeLabel) ? count + 1 : count;
                    }, 0);
                    
                    return (
                        <Col span={6} key={`store-stat-${store.value}`}>
                            <Statistic
                                title={<span style={{ fontSize: '16px', fontWeight: 500 }}>
                                    {store.label || 'Unknown Store'}
                                </span>}
                                value={storeCount}
                                valueStyle={statisticStyle}
                            />
                        </Col>
                    );
                })}
            </Row>
        );
    }, [stores, itemLocations]);

    const handleStoreChange = useCallback((value) => {
        console.log('Store change:', { value, stores });
        setSelectedStore(value);
        setPagination(prev => ({ ...prev, current: 1 }));
        
        // Update URL and refetch data with new store
        if (value === 'all' && user?.role === 'admin') {
            console.log('Navigating to inventory (all stores)');
            navigate('/inventory');
        } else {
            // Ensure we have a valid store ID
            const store = stores.find(s => s.value === value || s.id?.toString() === value?.toString());
            if (store) {
                const storeId = store.id?.toString() || store.value?.toString();
                console.log('Navigating to store:', { store, storeId });
                navigate(`/stores/${storeId}`);
            } else {
                console.error('Invalid store selected:', { value, availableStores: stores });
                message.error('Invalid store selected');
                navigate('/inventory');
            }
        }
    }, [navigate, user?.role, stores]);

    const handleSearch = useCallback((value) => {
        setSearchText(value);
        setPagination(prev => ({ ...prev, current: 1 }));
    }, []);

    // Add initial data loading with loading state protection and cleanup
    useEffect(() => {
        let mounted = true;
        let initializationStarted = false;
        
        const initialize = async () => {
            if (!mounted || initializationStarted || !user) return;
            
            initializationStarted = true;
            console.log('Starting initial data load');
            
            const result = await loadInitialData();
            if (!mounted) return;

            if (!result.success) {
                console.error('Initialization failed:', result.error);
                setError(result.error);
                message.error(result.error);
            }
        };

        initialize();
        
        return () => {
            mounted = false;
            initializationStarted = false;
            // Cleanup any pending requests
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [loadInitialData, user]);

    return (
        <div>
            {error && (
                <Alert
                    message="Error"
                    description={error}
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col span={24}>
                    <Card>
                        <Row gutter={16}>
                            <Col span={6}>
                                <Statistic
                                    title={<span style={{ fontSize: '16px', fontWeight: 500 }}>Total Records</span>}
                                    value={records.length}
                                    valueStyle={{ color: '#1890ff', fontSize: '24px' }}
                                />
                            </Col>
                            {renderStoreStatistics()}
                        </Row>
                    </Card>
                </Col>
                <Col span={24}>
                    <Card>
                        <Row gutter={16}>
                            <Col span={24}>
                                <Space size="middle" style={{ marginBottom: 16 }}>
                                <Select
                                        style={{ width: 200 }}
                                        value={selectedStore}
                                        onChange={handleStoreChange}
                                    >
                                        {stores.map(store => (
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
                                    <Button
                                        icon={<ReloadOutlined spin={refreshing} />}
                                        onClick={handleRefresh}
                                        loading={refreshing}
                                        disabled={loading || refreshing}
                                        style={{ minWidth: 100 }}
                                    >
                                        {refreshing ? 'Refreshing...' : 'Refresh'}
                                    </Button>
                                </Space>
                            </Col>
                        </Row>
                    </Card>
                </Col>

                <Col span={24}>
                    <Table {...tableProps} />
                </Col>
            </Row>

            <Modal
                title="Edit Record"
                open={editModalVisible}
                onOk={handleUpdate}
                onCancel={() => {
                    setEditModalVisible(false);
                    form.resetFields();
                }}
                destroyOnClose
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
        </div>
    );
};

export default InventoryPage; 