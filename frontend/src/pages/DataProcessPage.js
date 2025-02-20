import React, { useState, useEffect, useCallback } from 'react';
import {
    Card,
    Table,
    Tag,
    Space,
    Button,
    Modal,
    Alert,
    Typography,
    Tooltip,
    Badge,
    Switch,
    Select,
    message,
    Upload,
    Progress
} from 'antd';
import {
    SyncOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    WarningOutlined,
    DeleteOutlined,
    ReloadOutlined,
    ExclamationCircleOutlined,
    UploadOutlined
} from '@ant-design/icons';
import moment from 'moment';
import api from '../api';

const { Title, Text } = Typography;
const { Option } = Select;
const { Dragger } = Upload;

// Custom hook for setInterval with dependencies
const useInterval = (callback, delay) => {
    const savedCallback = React.useRef();

    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    useEffect(() => {
        if (delay !== null) {
            const id = setInterval(() => savedCallback.current(), delay);
            return () => clearInterval(id);
        }
    }, [delay]);
};

// 使用 Web Crypto API 計算 SHA-256
const calculateChecksum = async (data) => {
    const msgBuffer = new TextEncoder().encode(JSON.stringify(data));
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
};

const DataProcessPage = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0
    });
    const [selectedStatus, setSelectedStatus] = useState(null);
    const [detailModalVisible, setDetailModalVisible] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(30000); // 30 seconds default
    const [processingFile, setProcessingFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadModalVisible, setUploadModalVisible] = useState(false);

    // 獲取處理日誌
    const fetchLogs = useCallback(async (page = 1, status = null) => {
        try {
            setLoading(true);
            setError(null);
            
            const params = {
                page,
                limit: pagination.pageSize,
                ...(status && { status })
            };
            
            const response = await api.get('data-process/logs', { params });
            
            if (response.success) {
                setLogs(response.logs);
                setPagination({
                    ...pagination,
                    current: page,
                    total: response.total
                });
            } else {
                throw new Error(response.error?.message || 'Failed to fetch logs');
            }
        } catch (error) {
            setError(error.message);
            setAutoRefresh(false);
        } finally {
            setLoading(false);
        }
    }, [pagination.pageSize]);

    // 設置自動刷新
    useInterval(
        () => {
            // 只在有處理中的日誌時自動刷新
            const hasProcessingLogs = logs.some(log => log.status === 'processing');
            if (hasProcessingLogs) {
                fetchLogs(pagination.current, selectedStatus);
            } else {
                // 如果沒有處理中的日誌，關閉自動刷新
                setAutoRefresh(false);
            }
        },
        autoRefresh ? refreshInterval : null
    );

    // 清理舊日誌
    const handleClearLogs = async () => {
        try {
            const response = await api.delete('data-process/logs');
            if (response.success) {
                message.success(`${response.cleared} logs have been archived.`);
                fetchLogs(1, selectedStatus);
            }
        } catch (error) {
            message.error(error.message || 'Failed to clear logs');
        }
    };

    // 顯示日誌詳情
    const showLogDetail = (record) => {
        setSelectedLog(record);
        setDetailModalVisible(true);
    };

    // 刷新日誌
    const handleRefresh = () => {
        fetchLogs(pagination.current, selectedStatus);
    };

    // 處理表格變更
    const handleTableChange = (pagination, filters, sorter) => {
        fetchLogs(pagination.current, selectedStatus);
    };

    // 處理狀態篩選
    const handleStatusFilter = (status) => {
        setSelectedStatus(status);
        fetchLogs(1, status);
    };

    // 處理自動刷新開關
    const handleAutoRefreshChange = (checked) => {
        setAutoRefresh(checked);
    };

    // 處理刷新間隔變更
    const handleIntervalChange = (value) => {
        setRefreshInterval(value);
    };

    // 刪除單條記錄
    const handleDeleteRecord = async (record) => {
        Modal.confirm({
            title: 'Delete Confirmation',
            icon: <ExclamationCircleOutlined />,
            content: `Are you sure you want to delete the log record with batch ID: ${record.batch_id}?`,
            okText: 'Yes',
            okType: 'danger',
            cancelText: 'No',
            onOk: async () => {
                try {
                    const response = await api.delete(`data-process/logs/${record.batch_id}`);
                    if (response.success) {
                        message.success('Log record deleted successfully');
                        fetchLogs(pagination.current, selectedStatus);
                    } else {
                        throw new Error(response.error?.message || 'Failed to delete log record');
                    }
                } catch (error) {
                    console.error('Delete record error:', error);
                    message.error(error.message || 'Failed to delete log record');
                }
            }
        });
    };

    // 處理文件上傳
    const handleFileUpload = async (file) => {
        try {
            setProcessingFile(file);
            setUploadProgress(0);

            // 讀取文件內容
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const content = JSON.parse(e.target.result);
                    
                    // 計算 checksum
                    const checksum = await calculateChecksum(content.items);

                    // 準備請求數據
                    const requestData = {
                        source: 'file_upload',
                        timestamp: moment().toISOString(),
                        batch_id: `BATCH_${moment().format('YYYYMMDDHHmmss')}`,
                        items: content.items,
                        metadata: {
                            total_items: content.items.length,
                            version: '1.0',
                            checksum
                        }
                    };

                    // 發送處理請求
                    const response = await api.post('data-process/inventory', requestData, {
                        onUploadProgress: (progressEvent) => {
                            const percentage = Math.round(
                                (progressEvent.loaded * 100) / progressEvent.total
                            );
                            setUploadProgress(percentage);
                        }
                    });

                    if (response.success) {
                        message.success('File processed successfully');
                        setUploadModalVisible(false);
                        fetchLogs(1);
                    } else {
                        throw new Error(response.error?.message || 'Processing failed');
                    }
                } catch (error) {
                    message.error(error.message || 'Failed to process file');
                }
            };

            reader.readAsText(file);
            return false; // 阻止自動上傳
        } catch (error) {
            message.error('Failed to read file');
            return false;
        }
    };

    // 初始加載
    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // 狀態標籤顏色映射
    const statusColors = {
        processing: 'processing',
        completed: 'success',
        completed_with_errors: 'warning',
        failed: 'error'
    };

    // 表格列定義
    const columns = [
        {
            title: 'Batch ID',
            dataIndex: 'batch_id',
            key: 'batch_id',
            render: (text, record) => <a onClick={() => showLogDetail(record)}>{text}</a>
        },
        {
            title: 'Source',
            dataIndex: 'source',
            key: 'source'
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status) => (
                <Tag color={statusColors[status] || 'default'}>
                    {status.toUpperCase().replace('_', ' ')}
                </Tag>
            ),
            filters: [
                { text: 'Processing', value: 'processing' },
                { text: 'Completed', value: 'completed' },
                { text: 'Completed with Errors', value: 'completed_with_errors' },
                { text: 'Failed', value: 'failed' }
            ],
            onFilter: (value, record) => record.status === value
        },
        {
            title: 'Progress',
            key: 'progress',
            render: (_, record) => (
                <Space>
                    <Text>{record.processed_count}</Text>
                    <Text type="secondary">/</Text>
                    <Text>{record.total_items}</Text>
                    {record.error_count > 0 && (
                        <Tooltip title={`${record.error_count} errors`}>
                            <Badge count={record.error_count} style={{ backgroundColor: '#ff4d4f' }} />
                        </Tooltip>
                    )}
                </Space>
            )
        },
        {
            title: 'Started At',
            dataIndex: 'started_at',
            key: 'started_at',
            render: (date) => moment(date).format('YYYY-MM-DD HH:mm:ss')
        },
        {
            title: 'Completed At',
            dataIndex: 'completed_at',
            key: 'completed_at',
            render: (date) => date ? moment(date).format('YYYY-MM-DD HH:mm:ss') : '-'
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Button
                        type="link"
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteRecord(record)}
                        danger
                    >
                        Delete
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <div>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={handleRefresh}
                        loading={loading}
                    >
                        Refresh
                    </Button>
                    <Button
                        icon={<DeleteOutlined />}
                        onClick={handleClearLogs}
                        disabled={loading}
                    >
                        Clear Old Logs
                    </Button>
                    <Space>
                        <Switch
                            checkedChildren="Auto"
                            unCheckedChildren="Manual"
                            checked={autoRefresh}
                            onChange={handleAutoRefreshChange}
                        />
                        {autoRefresh && (
                            <Select
                                value={refreshInterval}
                                onChange={handleIntervalChange}
                                style={{ width: 120 }}
                            >
                                <Option value={5000}>5 seconds</Option>
                                <Option value={10000}>10 seconds</Option>
                                <Option value={30000}>30 seconds</Option>
                                <Option value={60000}>1 minute</Option>
                            </Select>
                        )}
                    </Space>
                </Space>
            </div>

            {error && (
                <Alert
                    message="Error"
                    description={error}
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            <Table
                columns={columns}
                dataSource={logs}
                rowKey="id"
                pagination={pagination}
                loading={loading}
                onChange={handleTableChange}
            />

            <Modal
                title="Processing Log Details"
                open={detailModalVisible}
                onCancel={() => setDetailModalVisible(false)}
                footer={null}
                width={800}
            >
                {selectedLog && (
                    <div>
                        <Space direction="vertical" style={{ width: '100%' }}>
                            <Card title="Basic Information" size="small">
                                <p><strong>Batch ID:</strong> {selectedLog.batch_id}</p>
                                <p><strong>Source:</strong> {selectedLog.source}</p>
                                <p><strong>Status:</strong> <Tag color={statusColors[selectedLog.status]}>{selectedLog.status.toUpperCase()}</Tag></p>
                                <p><strong>Started:</strong> {moment(selectedLog.started_at).format('YYYY-MM-DD HH:mm:ss')}</p>
                                {selectedLog.completed_at && (
                                    <p><strong>Completed:</strong> {moment(selectedLog.completed_at).format('YYYY-MM-DD HH:mm:ss')}</p>
                                )}
                            </Card>

                            <Card title="Processing Results" size="small">
                                <p><strong>Total Items:</strong> {selectedLog.total_items}</p>
                                <p><strong>Processed:</strong> {selectedLog.processed_count}</p>
                                <p><strong>Errors:</strong> {selectedLog.error_count}</p>
                            </Card>

                            {selectedLog.errors && selectedLog.errors.length > 0 && (
                                <Card title="Errors" size="small">
                                    <Table
                                        dataSource={selectedLog.errors}
                                        columns={[
                                            {
                                                title: 'Serial Number',
                                                dataIndex: 'serialnumber',
                                                key: 'serialnumber'
                                            },
                                            {
                                                title: 'Error',
                                                dataIndex: 'error',
                                                key: 'error'
                                            }
                                        ]}
                                        pagination={false}
                                        size="small"
                                    />
                                </Card>
                            )}
                        </Space>
                    </div>
                )}
            </Modal>

            <Modal
                title="Upload Data"
                open={uploadModalVisible}
                onCancel={() => {
                    setUploadModalVisible(false);
                    setProcessingFile(null);
                    setUploadProgress(0);
                }}
                footer={null}
            >
                <Dragger
                    name="file"
                    multiple={false}
                    beforeUpload={handleFileUpload}
                    showUploadList={false}
                    accept=".json"
                >
                    <p className="ant-upload-drag-icon">
                        <UploadOutlined />
                    </p>
                    <p className="ant-upload-text">Click or drag JSON file to this area to upload</p>
                    <p className="ant-upload-hint">
                        Support for a single JSON file upload. File should contain inventory data in the required format.
                    </p>
                </Dragger>

                {processingFile && (
                    <div style={{ marginTop: 16 }}>
                        <Progress percent={uploadProgress} />
                        <p>{processingFile.name}</p>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default DataProcessPage; 