import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Table, Card, Space, Button, message, Collapse, Input, Row, Col } from 'antd';
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import { orderApi } from '../services/api';

const { Panel } = Collapse;
const { Search } = Input;

const OrdersPage = () => {
    const { storeId } = useParams();
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState([]);
    const [exportLoading, setExportLoading] = useState(false);
    const [searchText, setSearchText] = useState('');

    useEffect(() => {
        if (storeId) {
            fetchOrders();
        }
    }, [storeId]);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const response = await orderApi.getOrders(storeId);
            console.log('Orders response:', response);
            if (response?.data?.success) {
                setOrders(response.data.orders);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
            message.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (value) => {
        setSearchText(value);
    };

    const handleExport = async () => {
        try {
            setExportLoading(true);
            
            // Create CSV content
            const csvContent = completedOrders.map(order => {
                return [
                    order.order_id,
                    order.serialnumber,
                    order.model,
                    order.price,
                    new Date(order.created_at).toLocaleString(),
                    order.notes
                ].join(',');
            });

            // Add header row
            const header = ['Order ID', 'Serial Number', 'Model', 'Price', 'Order Date', 'Notes'].join(',');
            const csvData = [header, ...csvContent].join('\n');

            // Create and download the file
            const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `store_${storeId}_completed_orders_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            message.success('Orders exported successfully');
        } catch (error) {
            console.error('Error exporting orders:', error);
            message.error('Failed to export orders');
        } finally {
            setExportLoading(false);
        }
    };

    const columns = [
        {
            title: 'Order ID',
            dataIndex: 'order_id',
            key: 'order_id',
            width: 100
        },
        {
            title: 'Serial Number',
            dataIndex: 'serialnumber',
            key: 'serialnumber',
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
            render: (price) => `$${price || 0}`
        },
        {
            title: 'Order Date',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 150,
            render: (date) => new Date(date).toLocaleString()
        },
        {
            title: 'Notes',
            dataIndex: 'notes',
            key: 'notes',
            width: 200
        }
    ];

    const filteredOrders = orders.filter(order => {
        const searchLower = searchText.toLowerCase();
        return (
            order.order_id.toString().includes(searchLower) ||
            (order.serialnumber || '').toLowerCase().includes(searchLower) ||
            (order.model || '').toLowerCase().includes(searchLower) ||
            (order.notes || '').toLowerCase().includes(searchLower)
        );
    });

    const pendingOrders = filteredOrders.filter(order => order.status !== 'completed');
    const completedOrders = filteredOrders.filter(order => order.status === 'completed');

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>Store Orders</h2>
                <Space>
                    <Search
                        placeholder="Search orders..."
                        allowClear
                        onSearch={handleSearch}
                        onChange={(e) => handleSearch(e.target.value)}
                        style={{ width: 300 }}
                    />
                    <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handleExport}
                        loading={exportLoading}
                    >
                        Export CSV
                    </Button>
                </Space>
            </div>

            <Space direction="vertical" style={{ width: '100%' }} size="large">
                {/* Pending Orders */}
                <Card title="Pending Orders">
                    <Table
                        columns={columns}
                        dataSource={pendingOrders}
                        rowKey="order_id"
                        loading={loading}
                        scroll={{ x: 1500 }}
                        pagination={false}
                    />
                </Card>

                {/* Completed Orders */}
                <Card title="Completed Orders">
                    <Collapse>
                        <Panel header="View Completed Orders" key="1">
                            <Table
                                columns={columns}
                                dataSource={completedOrders}
                                rowKey="order_id"
                                loading={loading}
                                scroll={{ x: 1500 }}
                                pagination={{
                                    showSizeChanger: true,
                                    showQuickJumper: true,
                                    pageSizeOptions: ['10', '20', '50']
                                }}
                            />
                        </Panel>
                    </Collapse>
                </Card>
            </Space>
        </div>
    );
};

export default OrdersPage; 