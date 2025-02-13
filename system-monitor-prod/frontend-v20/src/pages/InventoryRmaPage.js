import React, { useState, useEffect, useCallback } from 'react';
import { Table, Card, Space, Button, Tag, Modal, Input, message, Statistic, Typography, Alert } from 'antd';
import { DeleteOutlined, ExportOutlined } from '@ant-design/icons';
import { useRmaItems, useRmaOperations, useRmaStats } from '../hooks/useRma';
import { useAuth } from '../contexts/AuthContext';
import { rmaService } from '../api';
import moment from 'moment';

const { Search } = Input;
const { Paragraph } = Typography;

const InventoryRmaPage = () => {
    const { user } = useAuth();
    const [searchText, setSearchText] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    const { loading, data, refetch } = useRmaItems('inventory', page, pageSize);
    const { loading: operationLoading, processRma, completeRma, failRma, batchProcess } = useRmaOperations();
    const { stats } = useRmaStats();

    console.log('Raw RMA data:', data);

    const handleSearch = (value) => {
        setSearchText(value);
    };

    const handleUpdateRma = async (rmaId, field, value) => {
        try {
            await rmaService.updateInventoryRma(rmaId, { [field]: value });
            message.success(`${field} updated successfully`);
            refetch();
        } catch (error) {
            message.error(`Failed to update ${field}`);
        }
    };

    const handleTableChange = (pagination) => {
        setPage(pagination.current);
        setPageSize(pagination.pageSize);
    };

    const handleBatchProcess = async () => {
        if (await batchProcess(selectedItems)) {
            setSelectedItems([]);
            refetch();
        }
    };

    const handleExport = async () => {
        try {
            const response = await rmaService.exportToExcel({
                searchText,
                status: 'all'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'rma_items.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            message.error('Failed to export data');
        }
    };

    const showDeleteConfirm = (rmaId) => {
        Modal.confirm({
            title: 'Are you sure you want to delete this RMA item?',
            content: 'This action cannot be undone.',
            okText: 'Yes',
            okType: 'danger',
            cancelText: 'No',
            onOk: async () => {
                try {
                    await rmaService.deleteInventoryRma(rmaId);
                    message.success('RMA item deleted successfully');
                    refetch();
                } catch (error) {
                    message.error('Failed to delete RMA item');
                }
            },
        });
    };

    const handleProcess = async (rmaId) => {
        if (await processRma(rmaId)) {
            refetch();  // Immediately refetch data after successful process
        }
    };

    const handleComplete = async (rmaId) => {
        if (await completeRma(rmaId)) {
            refetch();  // Immediately refetch data after successful complete
        }
    };

    const handleFail = async (record) => {
        if (!record.reason?.trim()) {
            message.error('Please enter a reason before failing the RMA');
            return;
        }
        
        if (await failRma(record.rma_id, record.reason)) {
            refetch();
        }
    };

    const columns = [
        {
            title: 'Serial Number',
            dataIndex: 'serialnumber',
            key: 'serialnumber',
            width: 150
        },
        {
            title: 'Store',
            dataIndex: 'store_name',
            key: 'store_name',
            width: 150
        },
        {
            title: 'Model',
            dataIndex: 'model',
            key: 'model',
            width: 150
        },
        {
            title: 'System SKU',
            dataIndex: 'system_sku',
            key: 'system_sku',
            width: 150
        },
        {
            title: 'Reason',
            dataIndex: 'reason',
            key: 'reason',
            width: 200,
            render: (text, record) => {
                if (record.inventory_status === 'process') {
                    return (
                        <Paragraph
                            editable={{
                                onChange: (value) => handleUpdateRma(record.rma_id, 'reason', value),
                                tooltip: 'Click to edit'
                            }}
                            ellipsis={{ rows: 2, expandable: true }}
                        >
                            {text}
                        </Paragraph>
                    );
                }
                return <Paragraph ellipsis={{ rows: 2, expandable: true }}>{text}</Paragraph>;
            }
        },
        {
            title: 'Notes',
            dataIndex: 'notes',
            key: 'notes',
            width: 200,
            render: (text, record) => {
                if (record.inventory_status === 'process') {
                    return (
                        <Paragraph
                            editable={{
                                onChange: (value) => handleUpdateRma(record.rma_id, 'notes', value),
                                tooltip: 'Click to edit'
                            }}
                            ellipsis={{ rows: 2, expandable: true }}
                        >
                            {text}
                        </Paragraph>
                    );
                }
                return <Paragraph ellipsis={{ rows: 2, expandable: true }}>{text}</Paragraph>;
            }
        },
        {
            title: 'Status',
            dataIndex: 'inventory_status',
            key: 'inventory_status',
            width: 120,
            render: (status) => {
                const color = 
                    status === 'receive' ? 'orange' : 
                    status === 'process' ? 'blue' :
                    status === 'complete' ? 'green' : 
                    status === 'failed' ? 'red' : 'default';
                return <Tag color={color}>{status?.toUpperCase()}</Tag>;
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 200,
            render: (_, record) => {
                const actions = [];
                
                if (record.inventory_status === 'receive') {
                    actions.push(
                        <Button
                            key="process"
                            type="primary"
                            size="small"
                            loading={operationLoading}
                            onClick={() => handleProcess(record.rma_id)}
                        >
                            Process
                        </Button>
                    );
                }
                
                if (record.inventory_status === 'process') {
                    actions.push(
                        <Button
                            key="complete"
                            type="primary"
                            size="small"
                            loading={operationLoading}
                            onClick={() => handleComplete(record.rma_id)}
                        >
                            Complete
                        </Button>
                    );
                }
                
                if (['receive', 'process'].includes(record.inventory_status)) {
                    actions.push(
                        <Button
                            key="fail"
                            danger
                            size="small"
                            loading={operationLoading}
                            onClick={() => handleFail(record)}
                        >
                            Fail
                        </Button>
                    );
                }
                
                if (user?.group_name === 'admin') {
                    actions.push(
                        <Button
                            key="delete"
                            type="link"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => showDeleteConfirm(record.rma_id)}
                        >
                            Delete
                        </Button>
                    );
                }
                
                return <Space>{actions}</Space>;
            }
        }
    ];

    const filteredItems = (data?.success ? data.rma_items : []).filter(item => 
        !searchText || 
        item.serialnumber?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.notes?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.reason?.toLowerCase().includes(searchText.toLowerCase())
    );

    console.log('Filtered items:', filteredItems);

    const receiveItems = filteredItems.filter(item => item.inventory_status === 'receive');
    const processItems = filteredItems.filter(item => item.inventory_status === 'process');
    const completeItems = filteredItems.filter(item => item.inventory_status === 'complete');
    const failedItems = filteredItems.filter(item => item.inventory_status === 'failed');

    console.log('Items by status:', {
        receive: receiveItems,
        process: processItems,
        complete: completeItems,
        failed: failedItems
    });

    return (
        <div style={{ padding: '24px' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                <Space>
                    <Search
                        placeholder="Search by Serial Number, Notes, or Reason"
                        allowClear
                        onSearch={handleSearch}
                        style={{ width: 300 }}
                    />
                    {selectedItems.length > 0 && (
                        <Button
                            type="primary"
                            onClick={handleBatchProcess}
                            loading={operationLoading}
                        >
                            Process Selected ({selectedItems.length})
                        </Button>
                    )}
                    <Button
                        icon={<ExportOutlined />}
                        onClick={handleExport}
                    >
                        Export
                    </Button>
                </Space>

                {stats && (
                    <Card title="RMA Statistics">
                        <Space size="large">
                            <Statistic
                                title="Receive"
                                value={stats.statusCounts.receive || 0}
                                valueStyle={{ color: '#faad14' }}
                            />
                            <Statistic
                                title="Process"
                                value={stats.statusCounts.process || 0}
                                valueStyle={{ color: '#1890ff' }}
                            />
                            <Statistic
                                title="Complete"
                                value={stats.statusCounts.complete || 0}
                                valueStyle={{ color: '#52c41a' }}
                            />
                            <Statistic
                                title="Failed"
                                value={stats.statusCounts.failed || 0}
                                valueStyle={{ color: '#ff4d4f' }}
                            />
                        </Space>
                    </Card>
                )}

                <Card title="Receive RMA">
                    <Table
                        columns={columns}
                        dataSource={receiveItems}
                        rowKey="rma_id"
                        loading={loading}
                        pagination={false}
                        rowSelection={{
                            selectedRowKeys: selectedItems,
                            onChange: setSelectedItems,
                            getCheckboxProps: record => ({
                                disabled: record.inventory_status !== 'receive'
                            })
                        }}
                        scroll={{ x: 1500 }}
                    />
                </Card>

                <Card title="Process RMA">
                    <Table
                        columns={columns}
                        dataSource={processItems}
                        rowKey="rma_id"
                        loading={loading}
                        pagination={false}
                        scroll={{ x: 1500 }}
                    />
                </Card>

                <Card title="Complete RMA">
                    <Table
                        columns={columns.filter(col => col.key !== 'actions' || user?.group_name === 'admin')}
                        dataSource={completeItems}
                        rowKey="rma_id"
                        loading={loading}
                        pagination={false}
                        scroll={{ x: 1500 }}
                    />
                </Card>

                <Card title="Failed RMA">
                    <Table
                        columns={columns.filter(col => col.key !== 'actions' || user?.group_name === 'admin')}
                        dataSource={failedItems}
                        rowKey="rma_id"
                        loading={loading}
                        pagination={false}
                        scroll={{ x: 1500 }}
                    />
                </Card>
            </Space>
        </div>
    );
};

export default InventoryRmaPage; 