import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Card, Space, Button, Tag, Modal, Input, message, Statistic, Typography, Alert, Form, Row, Col } from 'antd';
import { DeleteOutlined, ExportOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useRmaItems, useRmaOperations, useRmaSearch } from '../hooks/useRma';
import { useAuth } from '../contexts/AuthContext';
import { rmaService } from '../api';
import { formatApiError } from '../api/utils/apiUtils';
import { formatDate, sortDate } from '../utils/formatters';
import moment from 'moment';

const { Search } = Input;
const { Paragraph } = Typography;
const { TextArea } = Input;

const StatusSection = ({ title, items, loading, columns, onTableChange, pagination }) => (
    <Card 
        title={title} 
        style={{ marginBottom: 16 }}
        extra={<Tag color="blue">{items.length}</Tag>}
    >
        <Table
            columns={columns}
            dataSource={items}
            rowKey="id"
            loading={loading}
            pagination={pagination}
            onChange={onTableChange}
            scroll={{ x: true }}
            size="small"
        />
    </Card>
);

const InventoryRmaPage = () => {
    const { user } = useAuth();
    const [searchText, setSearchText] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [processForm] = Form.useForm();
    const [completeForm] = Form.useForm();
    const [failForm] = Form.useForm();

    const { loading, data, error: fetchError, refetch } = useRmaItems('inventory', page, pageSize);
    const { loading: operationLoading, processRma, completeRma, failRma, batchProcess } = useRmaOperations();
    const { loading: searchLoading, searchItems } = useRmaSearch();

    useEffect(() => {
        if (data) {
            console.log('RMA Items Data:', {
                total: data.items?.length,
                items: data.items,
                itemsByStatus: data.itemsByStatus
            });
        }
    }, [data]);

    const filteredItems = useMemo(() => {
        if (!data?.items) return [];
        
        const items = data.items.filter(item => {
            if (!searchText) return true;
            const searchLower = searchText.toLowerCase();
            return (
                item.serialnumber?.toLowerCase().includes(searchLower) ||
                item.model?.toLowerCase().includes(searchLower) ||
                item.store_name?.toLowerCase().includes(searchLower) ||
                item.issue_description?.toLowerCase().includes(searchLower)
            );
        });
        
        console.log('Filtered Items:', {
            total: items.length,
            sample: items[0]
        });
        
        return items;
    }, [data?.items, searchText]);

    const itemsByStatus = useMemo(() => {
        const grouped = filteredItems.reduce((acc, item) => {
            const status = item.status || 'receive';
            if (!acc[status]) acc[status] = [];
            acc[status].push(item);
            return acc;
        }, { receive: [], process: [], complete: [], failed: [] });
        
        console.log('Items By Status:', {
            receive: grouped.receive.length,
            process: grouped.process.length,
            complete: grouped.complete.length,
            failed: grouped.failed.length,
            completeSample: grouped.complete[0]
        });
        
        return grouped;
    }, [filteredItems]);

    useEffect(() => {
        if (fetchError) {
            if (!fetchError.message?.includes('stats')) {
                message.error(formatApiError(fetchError));
            }
        }
    }, [fetchError]);

    const handleSearch = async (value) => {
        setSearchText(value);
        if (value) {
            const results = await searchItems(value);
            if (results.length === 0) {
                message.info('No matching RMA items found');
            }
        }
    };

    const handleUpdateRma = async (rmaId, field, value) => {
        try {
            const response = await rmaService.updateRmaItem(rmaId, { [field]: value });
            if (response?.success) {
                message.success(`${field} updated successfully`);
                refetch();
            } else {
                throw new Error(response?.error || `Failed to update ${field}`);
            }
        } catch (error) {
            message.error(error.message);
        }
    };

    const handleTableChange = (pagination) => {
        setPage(pagination.current);
        setPageSize(pagination.pageSize);
    };

    const handleBatchProcess = async () => {
        if (selectedItems.length === 0) {
            message.warning('Please select items to process');
            return;
        }

        Modal.confirm({
            title: 'Process Selected Items',
            content: (
                <Form form={processForm}>
                    <Form.Item
                        name="diagnosis"
                        label="Diagnosis"
                        rules={[{ required: true, message: 'Please enter diagnosis' }]}
                    >
                        <TextArea rows={4} />
                    </Form.Item>
                </Form>
            ),
            onOk: async () => {
                try {
                    const values = await processForm.validateFields();
                    const items = selectedItems.map(item => ({
                        id: item.id,
                        diagnosis: values.diagnosis
                    }));
                    if (await batchProcess(items)) {
                        setSelectedItems([]);
                        processForm.resetFields();
                        refetch();
                    }
                } catch (error) {
                    if (error.errorFields) {
                        return;
                    }
                    message.error('Failed to process items');
                }
            }
        });
    };

    const handleExport = async () => {
        try {
            const response = await rmaService.exportToExcel({
                searchText,
                status: 'all'
            });
            
            const blob = new Blob([response.data], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `rma_items_${moment().format('YYYY-MM-DD')}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            
            message.success('Export successful');
        } catch (error) {
            message.error(formatApiError(error));
        }
    };

    const showDeleteConfirm = useCallback((rmaId) => {
        const itemExists = data?.items?.some(item => item.id === rmaId);

        if (!itemExists) {
            console.error('Attempting to delete non-existent RMA item:', {
                rmaId,
                availableIds: data?.items?.map(item => ({
                    id: item.id,
                    store_rma_id: item.store_rma_id
                }))
            });
            message.error('Invalid RMA ID');
            return;
        }

        console.log('Attempting to delete RMA item:', { 
            rmaId,
            itemData: data?.items?.find(item => item.id === rmaId)
        });
        
        Modal.confirm({
            title: 'Delete RMA Item',
            content: 'Are you sure you want to delete this RMA item?',
            okText: 'Yes',
            okType: 'danger',
            cancelText: 'No',
            onOk: async () => {
                try {
                    console.log('Deleting RMA item with ID:', rmaId);
                    const response = await rmaService.deleteInventoryRma(rmaId);
                    console.log('Delete response:', response);
                    
                    if (response?.success) {
                        message.success('RMA item deleted successfully');
                        refetch();
                    } else {
                        throw new Error(response?.error || 'Failed to delete RMA item');
                    }
                } catch (error) {
                    console.error('Error deleting RMA item:', {
                        rmaId,
                        error: error.message,
                        response: error.response?.data,
                        availableIds: data?.items?.map(item => ({
                            id: item.id,
                            store_rma_id: item.store_rma_id
                        }))
                    });
                    message.error(formatApiError(error));
                }
            }
        });
    }, [refetch, data]);

    const handleProcess = async (rmaId) => {
        Modal.confirm({
            title: 'Process RMA Item',
            content: (
                <Form form={processForm}>
                    <Form.Item
                        name="diagnosis"
                        label="Diagnosis"
                        rules={[{ required: true, message: 'Please enter diagnosis' }]}
                    >
                        <TextArea rows={4} />
                    </Form.Item>
                </Form>
            ),
            onOk: async () => {
                try {
                    const values = await processForm.validateFields();
                    if (await processRma(rmaId, values.diagnosis)) {
                        processForm.resetFields();
                        refetch();
                    }
                } catch (error) {
                    if (error.errorFields) {
                        return;
                    }
                    message.error('Failed to process RMA item');
                }
            }
        });
    };

    const handleComplete = async (rmaId) => {
        Modal.confirm({
            title: 'Complete RMA Item',
            content: (
                <Form form={completeForm}>
                    <Form.Item
                        name="solution"
                        label="Solution"
                        rules={[{ required: true, message: 'Please enter solution' }]}
                    >
                        <TextArea rows={4} />
                    </Form.Item>
                </Form>
            ),
            onOk: async () => {
                try {
                    const values = await completeForm.validateFields();
                    if (await completeRma(rmaId, values.solution)) {
                        completeForm.resetFields();
                        refetch();
                    }
                } catch (error) {
                    if (error.errorFields) {
                        return;
                    }
                    message.error('Failed to complete RMA item');
                }
            }
        });
    };

    const handleFail = async (rmaId) => {
        Modal.confirm({
            title: 'Fail RMA Item',
            content: (
                <Form form={failForm}>
                    <Form.Item
                        name="reason"
                        label="Reason"
                        rules={[{ required: true, message: 'Please enter reason' }]}
                    >
                        <TextArea rows={4} />
                    </Form.Item>
                </Form>
            ),
            onOk: async () => {
                try {
                    const values = await failForm.validateFields();
                    if (await failRma(rmaId, values.reason)) {
                        failForm.resetFields();
                        refetch();
                    }
                } catch (error) {
                    if (error.errorFields) {
                        return;
                    }
                    message.error('Failed to fail RMA item');
                }
            }
        });
    };

    const baseColumns = [
        {
            title: 'Serial Number',
            dataIndex: 'serialnumber',
            key: 'serialnumber',
            width: 150,
            fixed: 'left'
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
            title: 'Issue Description',
            dataIndex: 'issue_description',
            key: 'issue_description',
            width: 200,
            render: (text) => (
                <Paragraph ellipsis={{ rows: 2, expandable: true }}>
                    {text}
                </Paragraph>
            )
        }
    ];

    const receiveColumns = [
        ...baseColumns,
        {
            title: 'Created At',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 150,
            render: formatDate,
            sorter: sortDate
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 120,
            render: (_, record) => (
                <Space>
                    <Button
                        type="primary"
                        size="small"
                        loading={operationLoading}
                        onClick={() => handleProcess(record.id)}
                    >
                        Process
                    </Button>
                    {user?.group_name === 'admin' && (
                        <Button
                            type="link"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => showDeleteConfirm(record.id)}
                        />
                    )}
                </Space>
            )
        }
    ];

    const processColumns = [
        ...baseColumns,
        {
            title: 'Diagnosis',
            dataIndex: 'diagnosis',
            key: 'diagnosis',
            width: 200,
            render: (text, record) => (
                <Paragraph
                    editable={{
                        onChange: (value) => handleUpdateRma(record.id, 'diagnosis', value),
                        tooltip: 'Click to edit'
                    }}
                    ellipsis={{ rows: 2, expandable: true }}
                >
                    {text}
                </Paragraph>
            )
        },
        {
            title: 'Processed At',
            dataIndex: 'processed_at',
            key: 'processed_at',
            width: 150,
            render: formatDate,
            sorter: sortDate
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 200,
            render: (_, record) => (
                <Space>
                    <Button
                        type="primary"
                        size="small"
                        loading={operationLoading}
                        onClick={() => handleComplete(record.id)}
                    >
                        Complete
                    </Button>
                    <Button
                        danger
                        size="small"
                        loading={operationLoading}
                        onClick={() => handleFail(record.id)}
                    >
                        Fail
                    </Button>
                </Space>
            )
        }
    ];

    const completeColumns = [
        ...baseColumns,
        {
            title: 'Solution',
            dataIndex: 'solution',
            key: 'solution',
            width: 200,
            render: (text) => (
                <Paragraph ellipsis={{ rows: 2, expandable: true }}>
                    {text}
                </Paragraph>
            )
        },
        {
            title: 'Completed At',
            dataIndex: 'completed_at',
            key: 'completed_at',
            width: 150,
            render: formatDate,
            sorter: sortDate
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 100,
            render: (_, record) => {
                console.log('Rendering complete item row:', {
                    id: record.id,
                    store_rma_id: record.store_rma_id,
                    status: record.status,
                    serialnumber: record.serialnumber,
                    record
                });

                const rmaId = record.id;
                if (!rmaId) {
                    console.error('Invalid record - missing id:', record);
                    return null;
                }

                return (
                    <Space>
                        {user?.group_name === 'admin' && (
                            <Button
                                type="link"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => {
                                    console.log('Delete button clicked for record:', {
                                        id: record.id,
                                        store_rma_id: record.store_rma_id,
                                        status: record.status,
                                        serialnumber: record.serialnumber,
                                        record
                                    });
                                    showDeleteConfirm(rmaId);
                                }}
                            />
                        )}
                    </Space>
                );
            }
        }
    ];

    const failedColumns = [
        ...baseColumns,
        {
            title: 'Reason',
            dataIndex: 'failed_reason',
            key: 'failed_reason',
            width: 200,
            render: (text) => (
                <Paragraph ellipsis={{ rows: 2, expandable: true }}>
                    {text}
                </Paragraph>
            )
        },
        {
            title: 'Failed At',
            dataIndex: 'failed_at',
            key: 'failed_at',
            width: 150,
            render: formatDate,
            sorter: sortDate
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 100,
            render: (_, record) => (
                <Space>
                    {user?.group_name === 'admin' && (
                        <Button
                            type="link"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => showDeleteConfirm(record.id)}
                        />
                    )}
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
                {fetchError && !fetchError.message?.includes('stats') && (
                    <Alert
                        message="Error"
                        description={formatApiError(fetchError)}
                        type="error"
                        showIcon
                        closable
                    />
                )}
                
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                        <Search
                            placeholder="Search RMA items..."
                            allowClear
                            loading={searchLoading}
                            onSearch={handleSearch}
                            style={{ width: 300 }}
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                        />
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={refetch}
                            loading={loading}
                        >
                            Refresh
                        </Button>
                    </Space>
                    <Button
                        icon={<ExportOutlined />}
                        onClick={handleExport}
                        disabled={loading || !filteredItems.length}
                    >
                        Export
                    </Button>
                </Space>

                <Row gutter={[16, 16]}>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="Pending"
                                value={itemsByStatus.receive.length}
                                loading={loading}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="In Process"
                                value={itemsByStatus.process.length}
                                loading={loading}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="Completed"
                                value={itemsByStatus.complete.length}
                                loading={loading}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="Failed"
                                value={itemsByStatus.failed.length}
                                loading={loading}
                            />
                        </Card>
                    </Col>
                </Row>

                {loading ? (
                    <Card loading={true} />
                ) : (
                    <>
                        <StatusSection
                            title="Pending RMA Items"
                            items={itemsByStatus.receive}
                            loading={loading}
                            columns={receiveColumns}
                            onTableChange={handleTableChange}
                            pagination={false}
                        />

                        <StatusSection
                            title="In Process RMA Items"
                            items={itemsByStatus.process}
                            loading={loading}
                            columns={processColumns}
                            onTableChange={handleTableChange}
                            pagination={false}
                        />

                        <StatusSection
                            title="Completed RMA Items"
                            items={itemsByStatus.complete}
                            loading={loading}
                            columns={completeColumns}
                            onTableChange={handleTableChange}
                            pagination={false}
                        />

                        <StatusSection
                            title="Failed RMA Items"
                            items={itemsByStatus.failed}
                            loading={loading}
                            columns={failedColumns}
                            onTableChange={handleTableChange}
                            pagination={false}
                        />
                    </>
                )}
            </Space>
        </div>
    );
};

export default InventoryRmaPage; 