import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Table, message, Row, Col, Card, Statistic, Button, Input, Space, Tag, Modal, Select, Form, InputNumber } from 'antd';
import { ReloadOutlined, SearchOutlined, ExportOutlined, DownloadOutlined, DeleteOutlined, EditOutlined, SendOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { storeService, inventoryService, salesService, rmaService, orderService } from '../api';
import { formatSystemSku, formatDate, formatDateForCSV, sortDate } from '../utils/formatters';

const { Search } = Input;
const { Option } = Select;

// Utility functions
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
    const [searchInputValue, setSearchInputValue] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [price, setPrice] = useState(0);
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [form] = Form.useForm();
    const [selectedItems, setSelectedItems] = useState([]);
    const [searchPerformed, setSearchPerformed] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editingNoteText, setEditingNoteText] = useState('');
    const [isNoteModalVisible, setIsNoteModalVisible] = useState(false);
    const [editingNotes, setEditingNotes] = useState({});
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);

    // 優化權限檢查，使用 useMemo 緩存所有權限相關的結果
    const permissions = useMemo(() => {
        if (!user || !storeId) return {
            isAdmin: false,
            storePermissions: {},
            hasAccess: false,
            hasOutbound: false
        };
        
        const isAdmin = user.group_name === 'admin';
        const storePermissions = user.store_permissions?.[storeId] || {};
        
        return {
            isAdmin,
            storePermissions,
            hasAccess: isAdmin || user.permitted_stores?.includes(Number(storeId)),
            hasOutbound: isAdmin || storePermissions.outbound === true
        };
    }, [user, storeId]);

    // 檢查是否有批量選擇權限
    const hasBulkSelectPermission = useMemo(() => {
        if (!user) return false;
        
        // 檢查全局權限
        if (user.group_name === 'admin' || 
            (user.main_permissions && user.main_permissions.bulk_select)) {
            return true;
        }
        
        // 檢查商店特定權限
        const storePermissions = user.store_permissions?.[storeId];
        return storePermissions?.bulk_select === true;
    }, [user, storeId]);

    // 檢查是否有訂單權限
    const hasOrderPermission = useMemo(() => {
        if (!user) return false;
        
        // 檢查全局權限
        if (user.group_name === 'admin') return true;
        
        // 檢查主要權限
        if (user.main_permissions?.orders === true) return true;
        
        // 檢查商店特定權限
        const storePermissions = user.store_permissions?.[storeId];
        if (!storePermissions) return false;
        
        // 檢查 orders 權限，支持字符串和布爾值
        return storePermissions.orders === true || storePermissions.orders === '1';
    }, [user, storeId]);

    // 1. 首先定義 handleError，因為它被其他函數使用
    const handleError = useCallback((error, operation) => {
        console.error(`${operation} error:`, error);
        const errorMessage = error.response?.data?.error || error.message || `Failed to ${operation}`;
        message.error(errorMessage);
    }, []);

    // 2. 然後定義 fetchOutboundItems
    const fetchOutboundItems = useCallback(async () => {
        try {
            setOutboundLoading(true);
            const response = await inventoryService.getOutboundItems();
            if (response?.items) {
                setOutboundRecords(response.items);
            } else {
                throw new Error('Failed to fetch outbound items');
            }
        } catch (error) {
            console.error('Error fetching outbound items:', error);
            message.error('Failed to fetch outbound items');
        } finally {
            setOutboundLoading(false);
        }
    }, []);

    // 3. 再定義 fetchStores
    const fetchStores = useCallback(async () => {
        try {
            const response = await storeService.getStores();
            if (response?.success) {
                const storeOptions = response.stores.map(store => ({
                    value: store.id,
                    label: store.name
                }));
                setStores(storeOptions);
            }
        } catch (error) {
            console.error('Error fetching stores:', error);
            message.error('Failed to fetch stores');
        }
    }, []);

    // 4. 再定義 handleOutbound
    const handleOutbound = useCallback(async () => {
        if (!permissions.hasOutbound) {
            message.error('You do not have permission to perform outbound operations');
            return;
        }

        try {
            await Promise.all([
                fetchOutboundItems(),
                fetchStores()
            ]);
            setOutboundModalVisible(true);
        } catch (error) {
            handleError(error, 'fetch outbound items');
        }
    }, [permissions.hasOutbound, fetchOutboundItems, fetchStores, handleError]);

    // 優化數據獲取邏輯
    const fetchData = useCallback(async () => {
        if (!user || !storeId || !permissions.hasAccess) return;

        try {
            setLoading(true);
            
            // 並行請求數據
            const [storeResponse, itemsResponse] = await Promise.all([
                storeService.getStoreById(storeId),
                storeService.getStoreItems(storeId, { exclude_ordered: true })
            ]);

            if (storeResponse?.success) {
                setStore(storeResponse.store);
            } else {
                throw new Error('Failed to fetch store information');
            }

            if (itemsResponse?.success) {
                // 使用 Map 來確保每個商品只出現一次
                const uniqueItems = new Map();
                itemsResponse.items.forEach(item => {
                    const key = `${item.id}_${item.serialnumber}`;
                    if (!uniqueItems.has(key)) {
                        uniqueItems.set(key, item);
                    }
                });
                const uniqueItemsArray = Array.from(uniqueItems.values());
                setRecords(uniqueItemsArray);
                setFilteredRecords(uniqueItemsArray);
            } else {
                throw new Error('Failed to fetch store items');
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            if (error.response?.status === 403) {
                message.error('You do not have permission to access this store');
                navigate('/inventory');
            } else {
                message.error(error.message || 'Failed to load data');
            }
        } finally {
            setLoading(false);
        }
    }, [user, storeId, permissions.hasAccess, navigate]);

    // 優化 useEffect
    useEffect(() => {
        if (!permissions.hasAccess) {
            message.error('You do not have permission to access this store');
            navigate('/inventory');
            return;
        }

        fetchData();
        fetchStores(); // 初始加載商店列表
    }, [permissions.hasAccess, fetchData, fetchStores, navigate]);

    // 優化搜索邏輯
    const handleSearch = useCallback((value) => {
        if (!value) {
            setFilteredRecords(records);
            setSearchPerformed(false);
            return;
        }
        
        const searchValue = value.toLowerCase();
        const filtered = records.filter(record => 
            record.serialnumber?.toLowerCase().includes(searchValue) ||
            record.model?.toLowerCase().includes(searchValue) ||
            record.systemsku?.toLowerCase().includes(searchValue)
        );
        setFilteredRecords(filtered);
        setSearchPerformed(true);
        setSearchInputValue(''); // Clear search input using state
    }, [records]);

    const handleModalClose = useCallback((type) => {
        switch(type) {
            case 'outbound':
                setOutboundModalVisible(false);
                setSelectedOutboundStore(null);
                setOutboundRecords([]);
                break;
            case 'sales':
                setSalesModalVisible(false);
                setSelectedItem(null);
                setPrice(0);
                setNotes('');
                break;
            case 'rma':
                setRmaModalVisible(false);
                setSelectedItem(null);
                setReason('');
                setNotes('');
                break;
        }
    }, []);

    const refreshData = useCallback(async (type) => {
        try {
            setLoading(true);
            await fetchData();
            
            if (type === 'outbound') {
                await fetchOutboundItems();
            }
            
            message.success(`${type} operation completed successfully`);
        } catch (error) {
            console.error(`Error refreshing ${type} data:`, error);
            message.error(`Failed to refresh ${type} data`);
        } finally {
            setLoading(false);
        }
    }, [fetchData, fetchOutboundItems]);

    const handleAddToOutbound = async (serialNumber) => {
        try {
            setOutboundLoading(true);
            const searchResponse = await inventoryService.searchRecords('serialnumber', serialNumber);
            if (searchResponse?.success && searchResponse.records?.length > 0) {
                const record = searchResponse.records[0];
                const addResponse = await inventoryService.addToOutbound(record.id);
                if (addResponse?.success) {
                    message.success('Item added to outbound successfully');
                    await fetchOutboundItems();
                    // Clear the input field after successful addition
                    setSearchInputValue('');
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
            const response = await inventoryService.removeFromOutbound(itemId);
            if (response?.success) {
                message.success('Item removed from outbound successfully');
                await fetchOutboundItems();
            } else {
                throw new Error(response?.error || 'Failed to remove item from outbound');
            }
        } catch (error) {
            console.error('Remove from outbound error:', error);
            message.error(error.message || 'Failed to remove item');
        } finally {
            setOutboundLoading(false);
        }
    };

    const handleUpdateNotes = async (itemId, notes) => {
        try {
            setOutboundLoading(true);
            const response = await inventoryService.updateOutboundItemNotes(itemId, notes);
            if (response?.success) {
                message.success('Notes updated successfully');
                // Update the local state
                setOutboundRecords(prevRecords =>
                    prevRecords.map(record =>
                        record.outbound_item_id === itemId
                            ? { ...record, notes }
                            : record
                    )
                );
            } else {
                throw new Error(response?.error || 'Failed to update notes');
            }
        } catch (error) {
            console.error('Update notes error:', error);
            message.error(error.message || 'Failed to update notes');
        } finally {
            setOutboundLoading(false);
        }
    };

    const handleSendToStore = async () => {
        if (!selectedOutboundStore) {
            message.error('Please select a store');
            return;
        }

        try {
            setOutboundLoading(true);
            
            // First update all notes
            const updateNotesPromises = outboundRecords.map(item => 
                item.notes ? inventoryService.updateOutboundItemNotes(item.outbound_item_id, item.notes) : Promise.resolve()
            );
            await Promise.all(updateNotesPromises);

            // Then send items to store
            const outboundIds = outboundRecords.map(item => item.outbound_item_id);
            const response = await inventoryService.sendToStore(selectedOutboundStore, outboundIds);
            
            if (response?.success) {
                message.success('Items sent to store successfully');
                handleModalClose('outbound');
                await refreshData('outbound');
            } else {
                throw new Error(response?.error || 'Failed to send items to store');
            }
        } catch (error) {
            console.error('Send to store error:', error);
            message.error(error.message || 'Failed to send items to store');
        } finally {
            setOutboundLoading(false);
        }
    };

    const handleExportCSV = async () => {
        try {
            setLoading(true);
            const response = await storeService.exportStoreInventory(storeId);
            
            // Create a blob from the response data
            const blob = new Blob([response], { type: 'text/csv' });
            
            // Create a download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `store-${storeId}-inventory-${new Date().toISOString().split('T')[0]}.csv`);
            
            // Append link to body, click it, and remove it
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up the URL
            window.URL.revokeObjectURL(url);
            
            message.success('Export successful');
        } catch (error) {
            console.error('Export error:', error);
            message.error('Failed to export data');
        } finally {
            setLoading(false);
        }
    };

    const handleSalesClick = () => {
        setSalesModalVisible(true);
    };

    const handleRmaClick = () => {
        setRmaModalVisible(true);
    };

    const handleSalesSearch = async () => {
        try {
            const response = await salesService.searchSales(storeId, searchInputValue);
            if (response?.success) {
                setSelectedItem(response.item);
            } else {
                message.warning('No item found with this serial number');
            }
        } catch (error) {
            console.error('Sales search error:', error);
            message.error('Failed to search item');
        }
    };

    const handleRmaSearch = async () => {
        try {
            const response = await rmaService.searchRma(storeId, searchInputValue);
            if (response?.success) {
                setSelectedItem(response.item);
            } else {
                message.warning('No item found with this serial number');
            }
        } catch (error) {
            console.error('RMA search error:', error);
            message.error('Failed to search item');
        }
    };

    const handleSalesSubmit = async () => {
        if (!selectedItem || !price) {
            message.error('Please fill in all required fields');
            return;
        }

        try {
            const response = await salesService.addToSales(storeId, {
                item_id: selectedItem.id,
                price,
                notes
            });

            if (response?.success) {
                message.success('Item added to sales successfully');
                handleModalClose('sales');
                await refreshData('sales');
            } else {
                throw new Error(response?.error || 'Failed to add item to sales');
            }
        } catch (error) {
            console.error('Sales submit error:', error);
            message.error(error.message || 'Failed to add item to sales');
        }
    };

    const handleRmaSubmit = async () => {
        if (!selectedItem || !reason) {
            message.error('Please fill in all required fields');
            return;
        }

        try {
            const response = await rmaService.addToRma(storeId, {
                item_id: selectedItem.id,
                reason,
                notes
            });

            if (response?.success) {
                message.success('Item added to RMA successfully');
                handleModalClose('rma');
                await refreshData('rma');
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
            const response = await storeService.deleteStoreItem(storeId, itemId);
            if (response?.success) {
                message.success('Item deleted successfully');
                // 添加延遲以確保後端處理完成
                setTimeout(async () => {
                    await fetchData();
                }, 500);
            } else {
                throw new Error(response?.error || 'Failed to delete item');
            }
        } catch (error) {
            console.error('Delete item error:', error);
            message.error(error.message || 'Failed to delete item');
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
            }
        });
    };

    const handleEditNote = (record) => {
        setEditingNoteId(record.id);
        setEditingNoteText(record.notes || '');
        setIsNoteModalVisible(true);
    };

    const handleSaveNote = async () => {
        try {
            await handleUpdateNotes(editingNoteId, editingNoteText);
            setIsNoteModalVisible(false);
            setEditingNoteId(null);
            setEditingNoteText('');
        } catch (error) {
            console.error('Save note error:', error);
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
            width: 150
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
            render: (text) => {
                if (!text) return 'N/A';
                return text.replace(/"/g, '');
            }
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
            sorter: (a, b) => sortDate(a.received_at, b.received_at)
        },
        {
            title: 'Notes',
            dataIndex: 'notes',
            key: 'notes',
            width: 200,
            render: (text, record) => (
                <Space>
                    <span>{text || '-'}</span>
                    <Button
                        type="link"
                        onClick={() => handleEditNote(record)}
                        icon={<EditOutlined />}
                    >
                        Edit
                    </Button>
                </Space>
            )
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

    // 處理全選
    const handleSelectAll = () => {
        if (selectedRowKeys.length === filteredRecords.length) {
            setSelectedRowKeys([]);
        } else {
            const newSelectedKeys = filteredRecords.map(record => `${record.id}_${record.serialnumber}`);
            setSelectedRowKeys(newSelectedKeys);
        }
    };

    // 處理批量添加到訂單
    const handleBulkAddToOrder = async () => {
        console.log('Selected row keys:', selectedRowKeys);
        console.log('Records:', records);

        if (selectedRowKeys.length === 0) {
            message.warning('Please select items to add to order');
            return;
        }

        try {
            // Extract record IDs from the composite keys
            const selectedIds = selectedRowKeys.map(key => Number(key.split('_')[0]));
            
            // 從 records 中找出被選中的項目
            const selectedItems = records.filter(record => selectedIds.includes(record.id));
            
            console.log('Selected items:', selectedItems);

            if (selectedItems.length === 0) {
                message.warning('No valid items selected');
                return;
            }

            // 格式化選中的項目
            const formattedItems = selectedItems.map(item => ({
                record_id: item.id,
                serialnumber: item.serialnumber,
                notes: item.notes || '',
                price: item.price || 0,
                pay_method: 'credit_card'
            }));

            // 調用 API
            const response = await orderService.bulkAddToOrder(storeId, formattedItems);

            if (response?.success) {
                message.success('Items added to order successfully');
                // 清除選中的項目
                setSelectedRowKeys([]);
                // 重新獲取數據
                await fetchData();
            } else {
                throw new Error(response?.error || 'Failed to add items to order');
            }
        } catch (error) {
            console.error('Bulk add to order error:', error);
            message.error(error.message || 'Failed to add items to order');
        }
    };

    // 表格行選擇配置
    const rowSelection = {
        type: 'checkbox',
        selectedRowKeys,
        onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys),
        columnWidth: 60,
        fixed: true,
        selections: hasBulkSelectPermission ? [
            {
                key: 'all',
                text: 'Select All',
                onSelect: handleSelectAll
            },
            {
                key: 'invert',
                text: 'Invert Selection',
                onSelect: () => {
                    const allKeys = filteredRecords.map(r => `${r.id}_${r.serialnumber}`);
                    const newSelectedKeys = allKeys.filter(key => !selectedRowKeys.includes(key));
                    setSelectedRowKeys(newSelectedKeys);
                }
            },
            {
                key: 'none',
                text: 'Clear Selection',
                onSelect: () => setSelectedRowKeys([])
            }
        ] : []
    };

    // 渲染工具欄
    const renderToolbar = () => (
        <Space style={{ marginBottom: 16 }}>
            <Search
                placeholder="Search by serial number"
                allowClear
                onSearch={handleSearch}
                value={searchInputValue}
                onChange={e => setSearchInputValue(e.target.value)}
                style={{ width: 200 }}
            />
            {hasOrderPermission && selectedRowKeys.length > 0 && (
                <Button
                    type="primary"
                    onClick={handleBulkAddToOrder}
                    loading={loading}
                >
                    Add {selectedRowKeys.length} items to Order
                </Button>
            )}
            {permissions.hasOutbound && (
                <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={handleOutbound}
                    loading={loading}
                >
                    Outbound
                </Button>
            )}
            <Button type="primary" onClick={handleExportCSV}>
                Export CSV
            </Button>
        </Space>
    );

    // Add OutboundModal component
    const renderOutboundModal = () => (
        <Modal
            title="Outbound Management"
            visible={outboundModalVisible}
            onCancel={() => handleModalClose('outbound')}
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
                        value={searchInputValue}
                        onChange={e => setSearchInputValue(e.target.value)}
                    />
                </Col>
                <Col span={8}>
                    <Select
                        style={{ width: '100%' }}
                        placeholder="Select store"
                        value={selectedOutboundStore}
                        onChange={value => setSelectedOutboundStore(value)}
                    >
                        {stores.map(store => (
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
                        title: 'Notes',
                        dataIndex: 'notes',
                        key: 'notes',
                        render: (text, record) => {
                            const isEditing = editingNotes[record.outbound_item_id];
                            return isEditing ? (
                                <Input.TextArea
                                    defaultValue={text}
                                    autoSize
                                    onBlur={e => {
                                        handleUpdateNotes(record.outbound_item_id, e.target.value);
                                        setEditingNotes(prev => ({
                                            ...prev,
                                            [record.outbound_item_id]: false
                                        }));
                                    }}
                                    onPressEnter={e => {
                                        e.preventDefault();
                                        e.target.blur();
                                    }}
                                />
                            ) : (
                                <div
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setEditingNotes(prev => ({
                                        ...prev,
                                        [record.outbound_item_id]: true
                                    }))}
                                >
                                    {text || 'Click to add notes'}
                                </div>
                            );
                        }
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
            />
        </Modal>
    );

    const renderSalesModal = () => (
        <Modal
            title="Add to Sales"
            open={salesModalVisible}
            onOk={handleSalesSubmit}
            onCancel={() => handleModalClose('sales')}
        >
            <Form form={form} layout="vertical">
                <Form.Item label="Serial Number">
                    <Space>
                        <Input
                            value={searchInputValue}
                            onChange={(e) => setSearchInputValue(e.target.value)}
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
            onCancel={() => handleModalClose('rma')}
        >
            <Form form={form} layout="vertical">
                <Form.Item label="Serial Number">
                    <Space>
                        <Input
                            value={searchInputValue}
                            onChange={(e) => setSearchInputValue(e.target.value)}
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
                columns={columns}
                dataSource={filteredRecords}
                loading={loading}
                rowKey={record => `${record.id}_${record.serialnumber}`}
                scroll={{ x: 'max-content' }}
                pagination={{ pageSize: 50 }}
                rowSelection={hasOrderPermission ? rowSelection : undefined}
            />

            {renderOutboundModal()}
            {renderSalesModal()}
            {renderRmaModal()}

            <Modal
                title="Edit Notes"
                open={isNoteModalVisible}
                onOk={handleSaveNote}
                onCancel={() => {
                    setIsNoteModalVisible(false);
                    setEditingNoteId(null);
                    setEditingNoteText('');
                }}
            >
                <Input.TextArea
                    value={editingNoteText}
                    onChange={(e) => setEditingNoteText(e.target.value)}
                    placeholder="Enter notes..."
                    autoSize={{ minRows: 3, maxRows: 5 }}
                />
            </Modal>
        </div>
    );
};

export default StorePage; 