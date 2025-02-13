import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Table, Card, message, Space, Tag, Alert, Button, DatePicker } from 'antd';
import { salesService } from '../api';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import moment from 'moment';

const { RangePicker } = DatePicker;

const StoreSalesPage = () => {
    const { storeId } = useParams();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [sales, setSales] = useState([]);
    const [dateRange, setDateRange] = useState([
        moment().startOf('month'),
        moment().endOf('month')
    ]);

    const fetchSales = async () => {
        try {
            setLoading(true);
            setError('');

            const params = {
                start_date: dateRange[0].format('YYYY-MM-DD'),
                end_date: dateRange[1].format('YYYY-MM-DD')
            };

            const response = await salesService.getSales(storeId, params);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to load sales data');
            }
            
            setSales(response.sales);
        } catch (error) {
            console.error('Error fetching sales:', error);
            setError(error.message || 'Failed to load sales data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSales();
    }, [storeId, dateRange]);

    const handleExportCSV = async () => {
        try {
            setLoading(true);
            setError('');
            
            const params = {
                start_date: dateRange[0].format('YYYY-MM-DD'),
                end_date: dateRange[1].format('YYYY-MM-DD'),
                format: 'csv'
            };
            
            const response = await salesService.exportSales(storeId, params);
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to export sales data');
            }
            
            // 觸發下載
            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sales_${moment().format('YYYY-MM-DD')}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            message.success('Sales data exported successfully');
        } catch (error) {
            console.error('Error exporting sales:', error);
            setError(error.message || 'Failed to export sales data');
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'Serial Number',
            dataIndex: 'serialnumber',
            key: 'serialnumber',
            width: 150,
            fixed: 'left'
        },
        {
            title: 'Computer Name',
            dataIndex: 'computername',
            key: 'computername',
            width: 150
        },
        {
            title: 'Model',
            dataIndex: 'model',
            key: 'model',
            width: 150
        },
        {
            title: 'Price',
            dataIndex: 'price',
            key: 'price',
            width: 100,
            render: (price) => `$${price.toFixed(2)}`
        },
        {
            title: 'Sale Date',
            dataIndex: 'sale_date',
            key: 'sale_date',
            width: 150,
            render: (date) => moment(date).format('YYYY-MM-DD HH:mm:ss')
        },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            width: 100,
            render: (status) => (
                <Tag color={status === 'completed' ? 'green' : 'orange'}>
                    {status}
                </Tag>
            )
        },
        {
            title: 'Notes',
            dataIndex: 'notes',
            key: 'notes',
            width: 200
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <Card 
                title="Sales Records"
                extra={
                    <Space>
                        <RangePicker
                            value={dateRange}
                            onChange={setDateRange}
                            disabled={loading}
                        />
                        <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            onClick={handleExportCSV}
                            disabled={loading}
                        >
                            Export
                        </Button>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={fetchSales}
                            disabled={loading}
                        >
                            Refresh
                        </Button>
                    </Space>
                }
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

                <Table
                    columns={columns}
                    dataSource={sales}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 1200 }}
                    pagination={{
                        showSizeChanger: true,
                        showQuickJumper: true,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        showTotal: (total) => `Total ${total} records`
                    }}
                />
            </Card>
        </div>
    );
};

export default StoreSalesPage; 