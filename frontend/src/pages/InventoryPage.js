import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { 
    Table, 
    Input, 
    Button, 
    message, 
    Popconfirm, 
    Space, 
    Tag, 
    Row, 
    Col, 
    Select, 
    Card, 
    Modal, 
    Form, 
    Statistic,
    Alert,
    Tooltip
} from 'antd';
import { 
    SearchOutlined, 
    ReloadOutlined,
    DeleteOutlined,
    EditOutlined,
    SendOutlined,
    ExclamationCircleOutlined,
    InfoCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { inventoryService, storeService } from '../api';
import { useNotification } from '../contexts/NotificationContext';
import moment from 'moment';
import { formatDate, formatSystemSku, formatOS, formatDisks } from '../utils/formatters';

const { Search } = Input;
const { Option } = Select;
const { confirm } = Modal;

const InventoryPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { "*": storeId } = useParams();
    const { user, logout } = useAuth();
    const [loading, setLoading] = useState(false);
    const [outboundLoading, setOutboundLoading] = useState(false);
    const [storesLoading, setStoresLoading] = useState(false);
    const [error, setError] = useState('');
    const [records, setRecords] = useState([]);
    const [duplicateSerials, setDuplicateSerials] = useState(new Map());
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
    const [outboundItems, setOutboundItems] = useState([]);
    const [outboundModalVisible, setOutboundModalVisible] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [storesList, setStoresList] = useState([]);
    const isFirstMount = useRef(true);
    const { addNotification } = useNotification();
    const [selectedStore, setSelectedStore] = useState(null);
    const [outboundSerialNumber, setOutboundSerialNumber] = useState('');
    const [itemLocations, setItemLocations] = useState({});

    // 使用 useRef 來存儲最後一次的搜索參數
    const lastSearchParams = useRef({
        searchText: '',
        page: 1,
        pageSize: 20,
        storeId: null
    });

    // 檢查用戶是否有 outbound 權限
    const hasOutboundPermission = useMemo(() => {
        return user?.group_name === 'admin' || 
            user?.main_permissions?.outbound === true;
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
                setLoading(true);
                setError('');
                const response = await inventoryService.getDuplicateRecords();
                
                console.log('Duplicates response:', {
                    success: response?.success,
                    data: response?.data,
                    timestamp: new Date().toISOString()
                });

                if (!response?.success) {
                    throw new Error(response?.error || 'Failed to fetch duplicates');
                }
                
                const duplicates = response.data?.duplicates || response.duplicates;
                if (!Array.isArray(duplicates)) {
                    throw new Error('Invalid duplicates data format');
                }
                
                // 創建一個 Map 來存儲每個序列號的出現次數和詳細信息
                const duplicatesMap = new Map();
                duplicates.forEach(dup => {
                    duplicatesMap.set(dup.serialnumber, {
                        count: dup.count,
                        timestamps: dup.timestamps || []
                    });
                });
                
                setDuplicateSerials(duplicatesMap);

                // 如果發現重複記錄，自動執行清理
                if (duplicatesMap.size > 0) {
                    console.log('Found duplicates, auto cleaning up...', {
                        duplicateCount: duplicatesMap.size,
                        timestamp: new Date().toISOString()
                    });
                    
                    try {
                        const cleanupResponse = await inventoryService.cleanupDuplicates();
                        
                        if (cleanupResponse.success) {
                            message.success('Duplicate records cleaned up automatically');
                            Modal.info({
                                title: 'Automatic Cleanup Results',
                                content: (
                                    <div>
                                        <p>Total records before: {cleanupResponse.details.totalBefore}</p>
                                        <p>Total records after: {cleanupResponse.details.totalAfter}</p>
                                        <p>Records archived: {cleanupResponse.details.archivedCount}</p>
                                        <p>Timestamp: {moment(cleanupResponse.details.timestamp).format('YYYY-MM-DD HH:mm:ss')}</p>
                                    </div>
                                ),
                                onOk: () => {
                                    // 重新獲取記錄
                                    fetchRecords(true);
                                    // 重新獲取重複項
                                    fetchDuplicates();
                                }
                            });
                        } else {
                            throw new Error(cleanupResponse.error || 'Failed to clean up duplicates');
                        }
                    } catch (error) {
                        console.error('Auto cleanup error:', error);
                        message.error('Failed to automatically clean up duplicates: ' + error.message);
                    }
                }
            } catch (error) {
                console.error('Fetch duplicates error:', error);
                setError(error.message || 'Failed to fetch duplicates');
                message.error(error.message || 'Failed to fetch duplicates');
            } finally {
                setLoading(false);
            }
        };

        if (isInitialLoad) {
            fetchDuplicates();
            setIsInitialLoad(false);
        }
    }, [isInitialLoad]);

    const handleSessionExpired = useCallback(() => {
        console.log('Session expired, but staying on current page');
        message.error('Session expired or insufficient permissions');
        // 移除自動跳轉
        // logout();
        // navigate('/login');
    }, []);

    const fetchRecords = useCallback(async (force = false) => {
        try {
            setLoading(true);
            setError('');

            // 檢查是否需要重新獲取數據
            if (!force && !isInitialLoad) {
                const currentParams = {
                    searchText,
                    page: pagination.current,
                    pageSize: pagination.pageSize,
                    storeId
                };

                if (JSON.stringify(currentParams) === JSON.stringify(lastSearchParams.current)) {
                    setLoading(false);
                    return;
                }
            }

            // 更新最後一次搜索參數
            lastSearchParams.current = {
                searchText,
                page: pagination.current,
                pageSize: pagination.pageSize,
                storeId
            };

            const response = await inventoryService.getInventoryRecords({
                page: pagination.current,
                limit: pagination.pageSize,
                search: searchText,
                store_id: storeId
            });

            if (!response?.success) {
                throw new Error(response?.error || 'Failed to fetch inventory data');
            }

            // 處理記錄數據
            if (response.records?.length > 0) {
                // 檢查每個記錄的位置
                const locationPromises = response.records.map(record => 
                    inventoryService.checkItemLocation(record.serialnumber)
                        .catch(error => {
                            console.warn(`Failed to check location for ${record.serialnumber}:`, error);
                            return { success: false };
                        })
                );
                
                const locations = await Promise.all(locationPromises);
                
                // 更新 locations state
                const newLocations = {};
                locations.forEach((locationResponse, index) => {
                    if (locationResponse?.success) {
                        newLocations[response.records[index].serialnumber] = locationResponse.data || locationResponse;
                    }
                });
                
                setItemLocations(prev => ({ ...prev, ...newLocations }));

                const processedRecords = response.records.map(record => {
                    const locationInfo = newLocations[record.serialnumber];
                    let location = 'Inventory';
                    let locationColor = 'green';

                    if (locationInfo) {
                        if (locationInfo.location === 'store') {
                            location = locationInfo.storeName || 'Store';
                            locationColor = 'blue';
                        } else if (locationInfo.location === 'outbound') {
                            location = 'Outbound';
                            locationColor = 'orange';
                        }
                    }

                    return {
                        ...record,
                        key: record.id,
                        location,
                        locationColor
                    };
                });

                setRecords(processedRecords);
                setFilteredRecords(processedRecords);
            } else {
                setRecords([]);
                setFilteredRecords([]);
            }

            // 更新統計數據
            setTotalRecords(response.totalAll || 0);
            setTotalItems(response.uniqueSerials || 0);
            setPagination(prev => ({
                ...prev,
                total: response.total || 0
            }));

        } catch (error) {
            console.error('Error in fetchRecords:', {
                error: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            setError(error.message || 'Failed to load inventory data');
        } finally {
            setLoading(false);
        }
    }, [pagination.current, pagination.pageSize, storeId, searchText, isInitialLoad]);

    // 初始加載
    useEffect(() => {
        if (isFirstMount.current) {
            fetchRecords(true);  // 強制第一次加載
            isFirstMount.current = false;
        }
    }, [fetchRecords]);

    // 處理分頁變化
    const handleTableChange = useCallback((newPagination, filters, sorter) => {
        setPagination(newPagination);
        fetchRecords();
    }, [fetchRecords]);

    // Fetch stores list
    useEffect(() => {
        const fetchStores = async () => {
            try {
                setStoresLoading(true);
                const response = await storeService.getStores();
                if (response?.success) {
                    // 將商店列表轉換為 Select 需要的格式
                    const formattedStores = (response.stores || []).map(store => ({
                        value: store.id,
                        label: store.name
                    }));
                    setStoresList(formattedStores);
                } else {
                    console.error('Failed to fetch stores:', response?.error);
                    message.error('Failed to load stores list');
                }
            } catch (error) {
                console.error('Error fetching stores:', error);
                message.error('Failed to load stores list');
            } finally {
                setStoresLoading(false);
            }
        };

        fetchStores();
    }, []);

    // Use selectedBranch and filteredRecords
    useEffect(() => {
        if (selectedBranch !== 'all') {
            const filtered = records.filter(record => 
                record.store_id === parseInt(selectedBranch, 10)
            );
            setFilteredRecords(filtered);
        } else {
            setFilteredRecords(records);
        }
    }, [selectedBranch, records]);

    // 獲取 Outbound 項目
    const fetchOutboundItems = useCallback(async () => {
        try {
            setOutboundLoading(true);
            setError('');
            
            console.log('Fetching outbound items...');
            const response = await inventoryService.getOutboundItems();
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to fetch outbound items');
            }
            
            // 確保每個項目都有必要的字段
            const processedItems = (response.items || []).map(item => ({
                ...item,
                key: item.outbound_item_id || item.id,
                outbound_item_id: item.outbound_item_id || item.id
            }));
            
            console.log('Outbound items fetched:', {
                count: processedItems.length,
                items: processedItems,
                timestamp: new Date().toISOString()
            });
            
            setOutboundItems(processedItems);
        } catch (error) {
            console.error('Failed to fetch outbound items:', error);
            setError(error.message || 'Failed to fetch outbound items');
            message.error(error.message || 'Failed to fetch outbound items');
        } finally {
            setOutboundLoading(false);
        }
    }, []);

    // Use addNotification
    const handleAddToOutbound = useCallback(async (record) => {
        try {
            setOutboundLoading(true);
            setError('');
            
            // 先檢查物品位置
            const locationResponse = await inventoryService.checkItemLocation(record.serialnumber);
            if (locationResponse?.success && locationResponse.location === 'outbound') {
                throw new Error('Item is already in outbound');
            }
            
            const response = await inventoryService.addToOutbound(record.id);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to add to outbound');
            }
            
            message.success('Item added to outbound successfully');
            addNotification('outbound', 'add');
            await fetchOutboundItems();
        } catch (error) {
            console.error('Error adding to outbound:', error);
            message.error(error.message || 'Failed to add to outbound');
            setError(error.message || 'Failed to add to outbound');
        } finally {
            setOutboundLoading(false);
        }
    }, [addNotification, fetchOutboundItems]);

    const handleEditSubmit = async () => {
        try {
            setLoading(true);
            setError('');
            const values = await form.validateFields();
            
            const response = await inventoryService.updateRecord(editingRecord.id, values);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to update record');
            }
            
            message.success('Record updated successfully');
            setEditModalVisible(false);
            form.resetFields();
            await fetchRecords();
        } catch (error) {
            console.error('Failed to update record:', error);
            setError(error.message || 'Failed to update record');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (recordId) => {
        try {
            setLoading(true);
            setError('');
            const response = await inventoryService.deleteRecord(recordId);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to delete record');
            }
            
            message.success('Record deleted successfully');
            await fetchRecords();
        } catch (error) {
            console.error('Failed to delete record:', error);
            setError(error.message || 'Failed to delete record');
        } finally {
            setLoading(false);
        }
    };

    // 當 Outbound Modal 打開時獲取項目
    useEffect(() => {
        if (outboundModalVisible) {
            fetchOutboundItems();
        }
    }, [outboundModalVisible, fetchOutboundItems]);

    // 處理商店選擇變更
    const handleStoreChange = (value) => {
        console.log('Selected store:', value);
        setSelectedStore(value);
    };

    // 處理發送到商店
    const handleSendToStore = useCallback(async (record) => {
        try {
            setLoading(true);
            setError('');
            const response = await inventoryService.sendToStore(record.store_id);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to send to store');
            }
            
            message.success('Items sent to store successfully');
            await fetchOutboundItems();
            await fetchRecords();
        } catch (error) {
            console.error('Failed to send to store:', error);
            setError(error.message || 'Failed to send to store');
        } finally {
            setLoading(false);
        }
    }, [fetchOutboundItems, fetchRecords]);

    // 處理從 Outbound 移除
    const handleRemoveFromOutbound = useCallback(async (itemId) => {
        if (!itemId) {
            message.error('Invalid item ID');
            return;
        }

        try {
            setOutboundLoading(true);
            setError('');
            
            console.log('Removing item from outbound:', {
                itemId,
                timestamp: new Date().toISOString()
            });
            
            const response = await inventoryService.removeFromOutbound(itemId);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to remove from outbound');
            }
            
            console.log('Item removed successfully:', {
                itemId,
                response,
                timestamp: new Date().toISOString()
            });
            
            message.success('Item removed from outbound successfully');
            await fetchOutboundItems();
        } catch (error) {
            console.error('Failed to remove from outbound:', error);
            setError(error.message || 'Failed to remove from outbound');
            message.error(error.message || 'Failed to remove from outbound');
        } finally {
            setOutboundLoading(false);
        }
    }, [fetchOutboundItems]);

    // 1. 先定義 handleCleanupDuplicates 函數
    const handleCleanupDuplicates = useCallback(() => {
        Modal.confirm({
            title: 'Clean Up Duplicate Records',
            icon: <ExclamationCircleOutlined />,
            content: 'This will archive all duplicate records, keeping only the latest record for each serial number. This action cannot be undone. Are you sure you want to proceed?',
            okText: 'Yes, Clean Up',
            okType: 'danger',
            cancelText: 'No',
            onOk: async () => {
                try {
                    setLoading(true);
                    const response = await inventoryService.cleanupDuplicates();
                    
                    if (response.success) {
                        message.success('Records cleaned up successfully');
                        // 顯示詳細信息
                        Modal.info({
                            title: 'Cleanup Results',
                            content: (
                                <div>
                                    <p>Total records before: {response.details.totalBefore}</p>
                                    <p>Total records after: {response.details.totalAfter}</p>
                                    <p>Records archived: {response.details.archivedCount}</p>
                                    <p>Timestamp: {moment(response.details.timestamp).format('YYYY-MM-DD HH:mm:ss')}</p>
                                </div>
                            )
                        });
                        // 重新獲取記錄
                        fetchRecords();
                    } else {
                        throw new Error(response.error || 'Failed to clean up records');
                    }
                } catch (error) {
                    console.error('Cleanup error:', error);
                    message.error(error.message || 'Failed to clean up records');
                } finally {
                    setLoading(false);
                }
            }
        });
    }, [setLoading, fetchRecords]);

    // 2. 然後定義 toolbarButtons
    const toolbarButtons = useMemo(() => (
        <Space>
            {hasOutboundPermission && (
                <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={() => setOutboundModalVisible(true)}
                >
                    Outbound Management
                </Button>
            )}
            <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                    setPagination(prev => ({ ...prev, current: 1 }));
                    fetchRecords(true);  // 添加 force 參數為 true
                }}
                loading={loading}  // 添加 loading 狀態
            >
                Refresh
            </Button>
            <Button
                icon={<DeleteOutlined />}
                onClick={handleCleanupDuplicates}
                disabled={loading}
            >
                Clean Up Duplicates
            </Button>
        </Space>
    ), [hasOutboundPermission, loading, handleCleanupDuplicates, setPagination, fetchRecords]);

    const columns = useMemo(() => [
        {
            title: 'Location',
            dataIndex: 'location',
            key: 'location',
            width: 120,
            fixed: 'left',
            render: (text, record) => (
                <Tooltip title={`Location: ${text}`}>
                    <Tag color={record.locationColor}>{text}</Tag>
                </Tooltip>
            )
        },
        {
            title: 'Serial Number',
            dataIndex: 'serialnumber',
            key: 'serialnumber',
            width: 200,
            fixed: 'left',
            render: (text) => {
                const duplicateInfo = duplicateSerials.get(text);
                return (
                    <Space>
                        {text}
                        {duplicateInfo && (
                            <Tooltip title={`Found ${duplicateInfo.count} records\nLast update: ${
                                new Date(Math.max(...duplicateInfo.timestamps)).toLocaleString()
                            }`}>
                                <Tag color="red">
                                    {duplicateInfo.count}x
                                </Tag>
                            </Tooltip>
                        )}
                    </Space>
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
            width: 120,
            render: (value) => {
                if (value === 'Yes' || value === 'Yes Detected') return 'Yes';
                return 'No';
            }
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
            render: formatDisks
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
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 150,
            render: (_, record) => (
                <Space>
                    <Tooltip title="Edit">
                        <Button
                            type="link"
                            icon={<EditOutlined />}
                            onClick={() => {
                                setEditingRecord(record);
                                form.setFieldsValue(record);
                                setEditModalVisible(true);
                            }}
                        />
                    </Tooltip>
                    {hasOutboundPermission && (
                        <Tooltip title="Add to Outbound">
                            <Button
                                type="link"
                                icon={<SendOutlined />}
                                onClick={() => handleAddToOutbound(record)}
                                disabled={record.location === 'Outbound'}
                            />
                        </Tooltip>
                    )}
                    {user?.group_name === 'admin' && (
                        <Tooltip title="Delete">
                            <Popconfirm
                                title="Are you sure you want to delete this record?"
                                onConfirm={() => handleDelete(record.id)}
                                okText="Yes"
                                cancelText="No"
                            >
                                <Button
                                    type="link"
                                    danger
                                    icon={<DeleteOutlined />}
                                />
                            </Popconfirm>
                        </Tooltip>
                    )}
                </Space>
            )
        }
    ], [hasOutboundPermission, user?.group_name, form, handleAddToOutbound, handleDelete]);

    const handleAddToOutboundBySerial = useCallback(async (serial) => {
        if (!serial || typeof serial !== 'string' || !serial.trim()) {
            message.error('Please enter a valid serial number');
            return;
        }

        try {
            setOutboundLoading(true);
            setError('');
            
            console.log('Adding item to outbound:', {
                serial,
                timestamp: new Date().toISOString()
            });
            
            const response = await inventoryService.addToOutboundBySerial(serial.trim());
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to add to outbound');
            }
            
            console.log('Item added successfully:', {
                serial,
                response,
                timestamp: new Date().toISOString()
            });
            
            message.success('Item added to outbound successfully');
            addNotification('outbound', 'add');
            await fetchOutboundItems();
            await fetchRecords();

            // Clear the input field after successful addition
            setOutboundSerialNumber('');
        } catch (error) {
            console.error('Error adding to outbound:', error);
            setError(error.message || 'Failed to add to outbound');
            message.error(error.message || 'Failed to add to outbound');
        } finally {
            setOutboundLoading(false);
        }
    }, [addNotification, fetchRecords, fetchOutboundItems]);

    const handleBulkSendToStore = useCallback(async () => {
        if (!selectedStore) {
            message.error('Please select a store first');
            return;
        }

        if (!outboundItems || outboundItems.length === 0) {
            message.error('No items to send');
            return;
        }

        try {
            setOutboundLoading(true);
            setError('');
            
            // 獲取所有 outbound items 的 ID
            const outboundIds = outboundItems.map(item => item.outbound_item_id);
            
            console.log('Sending items to store:', {
                storeId: selectedStore,
                outboundIds,
                timestamp: new Date().toISOString()
            });

            const response = await inventoryService.sendToStoreBulk(selectedStore, outboundIds);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to send to store');
            }
            
            message.success('Items sent to store successfully');
            await fetchOutboundItems();
            setSelectedStore(null);
        } catch (error) {
            console.error('Failed to send to store:', error);
            setError(error.message || 'Failed to send to store');
            message.error(error.message || 'Failed to send to store');
        } finally {
            setOutboundLoading(false);
        }
    }, [selectedStore, outboundItems, fetchOutboundItems]);

    // 處理搜索
    const handleSearch = useCallback((value) => {
        setSearchText(value);
        setPagination(prev => ({ ...prev, current: 1 }));
    }, []);

    // 使用防抖來處理搜索
    useEffect(() => {
        if (isFirstMount.current) return;

        const timer = setTimeout(() => {
            fetchRecords(false);  // 非強制加載
        }, 500);

        return () => clearTimeout(timer);
    }, [searchText, fetchRecords]);

    // Add the handleUpdateNotes function near other handlers
    const handleUpdateNotes = useCallback(async (itemId, notes) => {
        try {
            setOutboundLoading(true);
            setError('');
            
            console.log('Updating notes for item:', {
                itemId,
                notes,
                timestamp: new Date().toISOString()
            });
            
            const response = await inventoryService.updateOutboundItemNotes(itemId, notes);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to update notes');
            }
            
            message.success('Notes updated successfully');
            await fetchOutboundItems();
        } catch (error) {
            console.error('Failed to update notes:', error);
            setError(error.message || 'Failed to update notes');
            message.error(error.message || 'Failed to update notes');
        } finally {
            setOutboundLoading(false);
        }
    }, [fetchOutboundItems]);

    return (
        <div style={{ padding: '24px' }}>
            <Row gutter={[16, 16]}>
                <Col span={24}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                            <Search
                                placeholder="Search records..."
                                allowClear
                                onSearch={handleSearch}
                                style={{ width: 200 }}
                            />
                            <Select
                                value={selectedBranch}
                                onChange={value => {
                                    setSelectedBranch(value);
                                    setPagination(prev => ({ ...prev, current: 1 }));
                                }}
                                style={{ width: 200 }}
                            >
                                <Option value="all">All Branches</Option>
                                {storesList.map(store => (
                                    <Option key={store.value} value={store.value}>
                                        {store.label}
                                    </Option>
                                ))}
                            </Select>
                        </Space>
                        {toolbarButtons}
                    </Space>
                </Col>

                <Col span={24}>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Card>
                                <Statistic
                                    title="Total Records"
                                    value={totalRecords}
                                    loading={loading}
                                    suffix={
                                        <Tooltip title="Total number of records in the system, including historical records">
                                            <InfoCircleOutlined style={{ marginLeft: 8 }} />
                                        </Tooltip>
                                    }
                                />
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card>
                                <Statistic
                                    title="Unique Items"
                                    value={totalItems}
                                    loading={loading}
                                    suffix={
                                        <Tooltip title="Number of unique serial numbers in the system">
                                            <InfoCircleOutlined style={{ marginLeft: 8 }} />
                                        </Tooltip>
                                    }
                                />
                            </Card>
                        </Col>
                        <Col span={8}>
                            <Card>
                                <Statistic
                                    title="Duplicate Items"
                                    value={duplicateSerials.size}
                                    loading={loading}
                                    suffix={
                                        <Tooltip title="Number of serial numbers that appear multiple times">
                                            <InfoCircleOutlined style={{ marginLeft: 8 }} />
                                        </Tooltip>
                                    }
                                />
                            </Card>
                        </Col>
                    </Row>
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
                        dataSource={filteredRecords}
                        rowKey="id"
                        loading={loading}
                        pagination={pagination}
                        onChange={handleTableChange}
                        scroll={{ x: true }}
                    />
                </Col>
            </Row>

            <Modal
                title={editingRecord ? 'Edit Record' : 'Add Record'}
                open={editModalVisible}
                onOk={handleEditSubmit}
                onCancel={() => {
                    setEditModalVisible(false);
                    setEditingRecord(null);
                    setError('');
                    form.resetFields();
                }}
                confirmLoading={loading}
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
                
                <Form
                    form={form}
                    layout="vertical"
                >
                    {/* ... 表單字段 ... */}
                </Form>
            </Modal>

            {/* Outbound Modal */}
            <Modal
                title="Outbound Management"
                open={outboundModalVisible}
                onCancel={() => {
                    setOutboundModalVisible(false);
                    setError('');
                }}
                footer={null}
                width={800}
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

                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                    <Col xs={24} sm={12} md={8} lg={6}>
                        <Search
                            placeholder="Enter serial number to add..."
                            allowClear
                            enterButton="Add"
                            value={outboundSerialNumber}
                            onChange={e => setOutboundSerialNumber(e.target.value)}
                            onSearch={handleAddToOutboundBySerial}
                            style={{ width: '100%' }}
                        />
                    </Col>
                    <Col xs={24} sm={12} md={8} lg={6}>
                        <Select
                            placeholder="Select store"
                            style={{ width: '100%' }}
                            value={selectedStore}
                            onChange={handleStoreChange}
                        >
                            {storesList.map(store => (
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
                            onClick={handleBulkSendToStore}
                            disabled={!selectedStore || outboundItems.length === 0}
                        >
                            Send All to Store
                        </Button>
                    </Col>
                </Row>

                <Table
                    columns={[
                        {
                            title: 'Serial Number',
                            dataIndex: 'serialnumber',
                            key: 'serialnumber',
                            render: (text, record) => (
                                <Tooltip title={record.model}>
                                    {text}
                                </Tooltip>
                            )
                        },
                        {
                            title: 'Model',
                            dataIndex: 'model',
                            key: 'model',
                        },
                        {
                            title: 'Computer Name',
                            dataIndex: 'computername',
                            key: 'computername',
                        },
                        {
                            title: 'Status',
                            dataIndex: 'status',
                            key: 'status',
                            render: (text) => (
                                <Tag color={text === 'pending' ? 'orange' : 'green'}>
                                    {text || 'pending'}
                                </Tag>
                            )
                        },
                        {
                            title: 'Notes',
                            dataIndex: 'notes',
                            key: 'notes',
                            width: 200,
                            render: (text, record) => (
                                <Input.TextArea
                                    defaultValue={text}
                                    autoSize={{ minRows: 1, maxRows: 3 }}
                                    onBlur={(e) => handleUpdateNotes(record.outbound_item_id, e.target.value)}
                                    placeholder="Add notes..."
                                />
                            )
                        },
                        {
                            title: 'Actions',
                            key: 'actions',
                            render: (_, record) => (
                                <Space>
                                    <Popconfirm
                                        title="Are you sure you want to remove this item?"
                                        onConfirm={() => handleRemoveFromOutbound(record.outbound_item_id)}
                                        okText="Yes"
                                        cancelText="No"
                                    >
                                        <Button
                                            type="link"
                                            danger
                                            icon={<DeleteOutlined />}
                                        >
                                            Remove
                                        </Button>
                                    </Popconfirm>
                                </Space>
                            )
                        }
                    ]}
                    dataSource={outboundItems}
                    loading={outboundLoading}
                    pagination={false}
                    rowKey="outbound_item_id"
                    size="small"
                />
            </Modal>
        </div>
    );
};

export default InventoryPage;