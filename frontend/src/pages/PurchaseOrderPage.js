import React, { useState, useEffect, useCallback } from 'react';
import { 
    Tabs, 
    Button, 
    Input, 
    Space, 
    DatePicker, 
    Table,
    message,
    Upload,
    Modal,
    Select,
    Spin,
    Form,
    Typography,
    Popconfirm,
    Card,
    Tag
} from 'antd';
import {
    ImportOutlined,
    PlusOutlined,
    SearchOutlined,
    UploadOutlined,
    InboxOutlined,
    EyeOutlined,
    CheckCircleOutlined,
    DeleteOutlined,
    EditOutlined
} from '@ant-design/icons';
import moment from 'moment';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import poService from '../services/poService';
import { debounce } from 'lodash';
import VerifyDialog from '../components/verify/VerifyDialog';
import { tagService } from '../api/services';

const { RangePicker } = DatePicker;
const { Search } = Input;
const { Option } = Select;
const { Dragger } = Upload;
const { TextArea } = Input;
const { Title } = Typography;

const LOCAL_STORAGE_KEY = 'purchaseOrderListData';

const PurchaseOrderPage = () => {
    const { user } = useAuth(); // 獲取當前用戶信息
    const navigate = useNavigate();
    const location = useLocation();
    const isAdmin = user?.group_name === 'admin';

    // State
    const [activeTab, setActiveTab] = useState(location.state?.activeTab || 'order-list');
    const [searchText, setSearchText] = useState('');
    const [dateRange, setDateRange] = useState(null);
    const [loading, setLoading] = useState(false);
    const [orderListData, setOrderListData] = useState([]);
    const [inboundPoData, setInboundPoData] = useState([]);
    
    // Import Modal State
    const [importModalVisible, setImportModalVisible] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [sheetList, setSheetList] = useState([]);
    const [selectedSheet, setSelectedSheet] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importNote, setImportNote] = useState('');

    // Detail Modal State
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [detailData, setDetailData] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Form
    const [form] = Form.useForm();

    const [filterStatus, setFilterStatus] = useState(null);
    const [sortField, setSortField] = useState('order_date');
    const [sortOrder, setSortOrder] = useState('descend');

    // Add state for verify dialog
    const [verifyModalVisible, setVerifyModalVisible] = useState(false);
    const [verifyingRecord, setVerifyingRecord] = useState(null);

    // Add categories state
    const [categories, setCategories] = useState([]);

    // 使用 useCallback 和 debounce 優化搜索
    const debouncedSearch = useCallback(
        debounce((value) => {
            setSearchText(value);
        }, 300),
        []
    );

    // 從 localStorage 加載數據
    useEffect(() => {
        const loadSavedData = async () => {
            try {
                const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
                if (savedData) {
                    const parsedData = JSON.parse(savedData);
                    // 轉換日期字符串回 Date 對象
                    const processedData = parsedData.map(item => ({
                        ...item,
                        updatedAt: new Date(item.updatedAt)
                    }));
                    setOrderListData(processedData);
                }
            } catch (error) {
                console.error('Error loading data from localStorage:', error);
                message.error('Failed to load saved data');
            }
        };

        loadSavedData();
    }, []);

    // 保存數據到 localStorage
    const saveToLocalStorage = (data) => {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            message.error('Failed to save data');
        }
    };

    // Handlers
    const handleTabChange = (key) => {
        setActiveTab(key);
    };

    const handleSearch = (value) => {
        debouncedSearch(value);
    };

    const handleDateRangeChange = (dates) => {
        setDateRange(dates);
    };

    const handleImportModalOpen = () => {
        setImportModalVisible(true);
        setSelectedFile(null);
        setSheetList([]);
        setSelectedSheet(null);
        setImportNote('');
    };

    const handleImportModalClose = () => {
        setImportModalVisible(false);
        setSelectedFile(null);
        setSheetList([]);
        setSelectedSheet(null);
        setImportNote('');
    };

    const handleFileRead = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    resolve(workbook);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(file);
        });
    };

    const handleBeforeUpload = async (file) => {
        try {
            const workbook = await handleFileRead(file);
            const sheets = workbook.SheetNames;
            setSheetList(sheets);
            setSelectedFile(file);
            setSelectedSheet(sheets[0]); // 默認選擇第一個sheet
        } catch (error) {
            message.error('Failed to read file');
            console.error('File read error:', error);
        }
        return false; // 阻止自動上傳
    };

    const handleImport = async () => {
        if (!selectedFile || !selectedSheet) {
            message.error('Please select a file and sheet');
            return;
        }

        setImporting(true);
        try {
            const workbook = await handleFileRead(selectedFile);
            const worksheet = workbook.Sheets[selectedSheet];
            const data = XLSX.utils.sheet_to_json(worksheet);
            
            // 創建新的導入記錄
            const newImport = {
                id: Date.now(),
                fileName: selectedFile.name,
                updatedAt: new Date(),
                note: importNote,
                status: 'pending',
                sheetData: data,
                sheet: selectedSheet
            };
            
            // 更新列表數據並保存
            const newData = [newImport, ...orderListData];
            setOrderListData(newData);
            saveToLocalStorage(newData);
            
            message.success(`Successfully imported ${data.length} records from ${selectedSheet}`);
            handleImportModalClose();
            
        } catch (error) {
            message.error('Failed to import data');
            console.error('Import error:', error);
        } finally {
            setImporting(false);
        }
    };

    const handleAddRecord = () => {
        // TODO: Implement add record logic
    };

    const handleViewDetail = (record) => {
        setDetailData(record);
        setDetailModalVisible(true);
    };

    const handleVerify = (record) => {
        setVerifyingRecord(record);
        setVerifyModalVisible(true);
    };

    // 處理驗證完成
    const handleVerifyComplete = (processedItems) => {
        // 更新當前記錄的狀態為 verified
        const updatedData = orderListData.map(item => {
            if (item.id === verifyingRecord.id) {
                return {
                    ...item,
                    status: 'verified'
                };
            }
            return item;
        });
        
        // 保存更新後的數據到 localStorage
        setOrderListData(updatedData);
        saveToLocalStorage(updatedData);
        
        // 導航到添加頁面
        navigate('/inbound/purchase-order/add', {
            state: { importedItems: processedItems }
        });
    };

    // 優化數據加載
    const fetchPOList = useCallback(async () => {
        try {
            setLoading(true);
            const response = await poService.getAllPOs();
            if (response?.success) {
                // 獲取每個 PO 的詳細信息以獲取正確的 items 數量
                const poList = response.data || [];
                const detailedPoList = await Promise.all(
                    poList.map(async (po) => {
                        try {
                            const detailResponse = await poService.getPOById(po.id);
                            if (detailResponse?.success) {
                                return {
                                    ...po,
                                    total_items: detailResponse.data?.items?.length || 0
                                };
                            }
                            return po;
                        } catch (error) {
                            console.error(`Error fetching details for PO ${po.id}:`, error);
                            return po;
                        }
                    })
                );

                setInboundPoData(detailedPoList);
                // 緩存數據
                localStorage.setItem('po_list_cache', JSON.stringify({
                    data: detailedPoList,
                    timestamp: Date.now()
                }));
            } else {
                setInboundPoData([]); // 如果沒有數據，設置為空數組
            }
        } catch (error) {
            console.error('Error fetching PO list:', error);
            message.error('Failed to load purchase orders');
            setInboundPoData([]); // 錯誤時設置為空數組
        } finally {
            setLoading(false);
        }
    }, []);

    // 在組件掛載時加載數據
    useEffect(() => {
        fetchPOList();
    }, [fetchPOList]);

    // Update fetchCategories function
    const fetchCategories = useCallback(async () => {
        try {
            const response = await tagService.getCategories();
            if (response?.success) {
                setCategories(response.categories || []);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
            message.error('Failed to load categories');
        }
    }, []);

    // Update useEffect to fetch categories
    useEffect(() => {
        fetchPOList();
        fetchCategories();
    }, [fetchPOList, fetchCategories]);

    // 更新 handleDelete 函數
    const handleDelete = async (id) => {
        try {
            // For Order List items, use local deletion
            if (activeTab === 'order-list') {
                const newData = orderListData.filter(item => item.id !== id);
                setOrderListData(newData);
                saveToLocalStorage(newData);
                message.success('Record deleted successfully');
                return;
            }

            // For Inbound PO items, use API deletion
            await poService.deletePO(id);
            message.success('Purchase order deleted successfully');
            await fetchPOList(); // 重新加載數據
        } catch (error) {
            message.error(error.response?.data?.error?.message || 'Failed to delete record');
        }
    };

    // Table columns
    const orderListColumns = [
        {
            title: 'File Name',
            dataIndex: 'fileName',
            key: 'fileName',
        },
        {
            title: 'Updated At',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            render: (date) => moment(date).format('YYYY-MM-DD HH:mm:ss'),
        },
        {
            title: 'Note',
            dataIndex: 'note',
            key: 'note',
            ellipsis: true,
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <span style={{ 
                    color: status === 'verified' ? '#52c41a' : 
                           status === 'pending' ? '#faad14' : '#1890ff' 
                }}>
                    {status === 'pending' ? 'Verified' : status}
                </span>
            ),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Button 
                        type="link" 
                        icon={<EyeOutlined />}
                        onClick={() => handleViewDetail(record)}
                    >
                        Detail
                    </Button>
                    <Button 
                        type="link" 
                        icon={<CheckCircleOutlined />}
                        onClick={() => handleVerify(record)}
                        disabled={record.status !== 'pending'}
                    >
                        Verify
                    </Button>
                    {isAdmin && (
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
                            >
                                Delete
                            </Button>
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    const inboundPoColumns = [
        {
            title: 'PO Number',
            dataIndex: 'po_number',
            key: 'po_number',
            render: (text, record) => (
                <Button 
                    type="link" 
                    onClick={() => navigate(`/inbound/purchase-order/detail/${record.id}`)}
                >
                    {text}
                </Button>
            ),
            sorter: (a, b) => a.po_number.localeCompare(b.po_number),
            filterable: true,
        },
        {
            title: 'Date',
            dataIndex: 'order_date',
            key: 'order_date',
            render: (date) => moment(date).format('YYYY-MM-DD'),
            sorter: (a, b) => moment(a.order_date).unix() - moment(b.order_date).unix(),
            defaultSortOrder: 'descend',
        },
        {
            title: 'Supplier',
            dataIndex: 'supplier',
            key: 'supplier',
            sorter: (a, b) => a.supplier.localeCompare(b.supplier),
            filters: [
                ...new Set(inboundPoData.map(item => item.supplier))
            ].map(supplier => ({
                text: supplier,
                value: supplier,
            })),
            onFilter: (value, record) => record.supplier === value,
        },
        {
            title: 'Total Items',
            dataIndex: 'total_items',
            key: 'total_items',
            render: (_, record) => (
                <Tag color="blue">
                    {record.total_items || record.items?.length || 0}
                </Tag>
            ),
            width: 100
        },
        {
            title: 'Matched SN',
            key: 'matched_sn',
            width: 200,
            render: (_, record) => {
                if (!searchText) return null;
                const searchLower = searchText.toLowerCase();
                const matchedSNs = record.items?.filter(item => 
                    item.serialnumber?.toLowerCase().includes(searchLower)
                ) || [];
                
                if (matchedSNs.length === 0) return null;
                
                return (
                    <Space direction="vertical">
                        {matchedSNs.map((item, index) => (
                            <Tag key={index} color="green">
                                {item.serialnumber}
                            </Tag>
                        ))}
                    </Space>
                );
            }
        },
        {
            title: 'Total Amount',
            dataIndex: 'total_amount',
            key: 'total_amount',
            render: (amount) => `$${Number(amount).toFixed(2)}`,
            sorter: (a, b) => Number(a.total_amount) - Number(b.total_amount),
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Button
                        type="text"
                        icon={<EyeOutlined />}
                        onClick={() => navigate(`/inbound/purchase-order/detail/${record.id}`)}
                    >
                        View
                    </Button>
                    <Popconfirm
                        title="Are you sure you want to delete this purchase order?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Yes"
                        cancelText="No"
                    >
                        <Button
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                        >
                            Delete
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    // 更新 getFilteredData 函數
    const getFilteredData = () => {
        let filteredData = [...inboundPoData];

        // Apply search filter
        if (searchText) {
            const searchLower = searchText.toLowerCase();
            filteredData = filteredData.filter(record => {
                // Search in PO number and supplier
                const poMatch = record.po_number?.toLowerCase().includes(searchLower);
                const supplierMatch = record.supplier?.toLowerCase().includes(searchLower);
                
                // Search in items' serial numbers
                const itemMatch = record.items?.some(item => 
                    item.serialnumber?.toLowerCase().includes(searchLower)
                );

                return poMatch || supplierMatch || itemMatch;
            });
        }

        // Apply date range filter
        if (dateRange && dateRange[0] && dateRange[1]) {
            const startDate = dateRange[0].startOf('day');
            const endDate = dateRange[1].endOf('day');
            filteredData = filteredData.filter(record => {
                const recordDate = moment(record.order_date);
                return recordDate.isBetween(startDate, endDate, 'day', '[]');
            });
        }

        // Apply status filter
        if (filterStatus) {
            filteredData = filteredData.filter(record => record.status === filterStatus);
        }

        return filteredData;
    };

    // 處理表格變更
    const handleTableChange = (pagination, filters, sorter) => {
        if (sorter.field) {
            setSortField(sorter.field);
            setSortOrder(sorter.order);
        }
    };

    // Render functions
    const renderToolbar = () => (
        <Space style={{ marginBottom: 16 }}>
            <Button 
                icon={<ImportOutlined />}
                onClick={handleImportModalOpen}
            >
                Import
            </Button>
            <Button 
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/inbound/purchase-order/add')}
            >
                Add PO
            </Button>
            <Search
                placeholder="Search PO number, supplier, note or serial number"
                allowClear
                onSearch={handleSearch}
                style={{ width: 350 }}
            />
            <RangePicker
                onChange={handleDateRangeChange}
                style={{ width: 250 }}
            />
            <Select
                placeholder="Filter by status"
                allowClear
                style={{ width: 150 }}
                onChange={setFilterStatus}
            >
                <Option value="draft">Draft</Option>
                <Option value="pending">Pending</Option>
                <Option value="completed">Completed</Option>
            </Select>
        </Space>
    );

    return (
        <div style={{ padding: 24 }}>
            <Card title="Purchase Orders">
                {renderToolbar()}
                <Tabs
                    activeKey={activeTab}
                    onChange={handleTabChange}
                    items={[
                        {
                            key: 'order-list',
                            label: 'Order List',
                            children: (
                                <Table
                                    columns={orderListColumns}
                                    dataSource={orderListData}
                                    loading={loading}
                                    rowKey="id"
                                    pagination={{
                                        showSizeChanger: true,
                                        showQuickJumper: true,
                                        showTotal: (total) => `Total ${total} items`,
                                    }}
                                />
                            ),
                        },
                        {
                            key: 'inbound-po',
                            label: 'Inbound PO',
                            children: (
                                <Table
                                    columns={inboundPoColumns}
                                    dataSource={getFilteredData()}
                                    loading={loading}
                                    rowKey="id"
                                    onChange={handleTableChange}
                                    pagination={{
                                        showSizeChanger: true,
                                        showQuickJumper: true,
                                        showTotal: (total) => `Total ${total} items`,
                                    }}
                                />
                            ),
                        },
                    ]}
                />
            </Card>

            <Modal
                title="Import File"
                open={importModalVisible}
                onCancel={handleImportModalClose}
                footer={[
                    <Button key="cancel" onClick={handleImportModalClose}>
                        Cancel
                    </Button>,
                    <Button
                        key="import"
                        type="primary"
                        onClick={handleImport}
                        disabled={!selectedFile || !selectedSheet}
                        loading={importing}
                    >
                        Import
                    </Button>
                ]}
            >
                <Spin spinning={importing}>
                    <div style={{ marginBottom: 16 }}>
                        <Dragger
                            accept=".xlsx,.xls,.csv"
                            beforeUpload={handleBeforeUpload}
                            showUploadList={false}
                            multiple={false}
                        >
                            <p className="ant-upload-drag-icon">
                                <InboxOutlined />
                            </p>
                            <p className="ant-upload-text">
                                Click or drag file to this area to upload
                            </p>
                            <p className="ant-upload-hint">
                                Support for .xlsx, .xls, .csv files
                            </p>
                        </Dragger>
                    </div>

                    {selectedFile && (
                        <div style={{ marginBottom: 16 }}>
                            <p>Selected file: {selectedFile.name}</p>
                            {sheetList.length > 0 && (
                                <div style={{ marginTop: 16 }}>
                                    <label style={{ marginBottom: 8, display: 'block' }}>
                                        Select Sheet:
                                    </label>
                                    <Select
                                        style={{ width: '100%', marginBottom: 16 }}
                                        value={selectedSheet}
                                        onChange={setSelectedSheet}
                                    >
                                        {sheetList.map(sheet => (
                                            <Option key={sheet} value={sheet}>
                                                {sheet}
                                            </Option>
                                        ))}
                                    </Select>
                                    <label style={{ marginBottom: 8, display: 'block' }}>
                                        Note:
                                    </label>
                                    <TextArea
                                        rows={4}
                                        value={importNote}
                                        onChange={(e) => setImportNote(e.target.value)}
                                        placeholder="Enter note for this import"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </Spin>
            </Modal>

            <Modal
                title={`File Details: ${detailData?.fileName}`}
                open={detailModalVisible}
                onCancel={() => setDetailModalVisible(false)}
                width={1000}
                footer={null}
            >
                <Spin spinning={detailLoading}>
                    {detailData && (
                        <>
                            <div style={{ marginBottom: 16 }}>
                                <p><strong>Sheet Name:</strong> {detailData.sheet}</p>
                                <p><strong>Import Time:</strong> {moment(detailData.updatedAt).format('YYYY-MM-DD HH:mm:ss')}</p>
                                <p><strong>Status:</strong> {detailData.status}</p>
                                <p><strong>Note:</strong> {detailData.note || 'N/A'}</p>
                            </div>
                            <Table
                                dataSource={detailData.sheetData}
                                columns={Object.keys(detailData.sheetData[0] || {}).map(key => ({
                                    title: key,
                                    dataIndex: key,
                                    key: key,
                                }))}
                                scroll={{ x: 'max-content' }}
                                pagination={{
                                    showSizeChanger: true,
                                    showQuickJumper: true,
                                    showTotal: (total) => `Total ${total} items`,
                                }}
                            />
                        </>
                    )}
                </Spin>
            </Modal>

            {verifyingRecord && (
                <VerifyDialog
                    visible={verifyModalVisible}
                    onCancel={() => {
                        setVerifyModalVisible(false);
                        setVerifyingRecord(null);
                    }}
                    onComplete={handleVerifyComplete}
                    sheetData={verifyingRecord.sheetData}
                    categories={categories}
                />
            )}
        </div>
    );
};

export default PurchaseOrderPage; 