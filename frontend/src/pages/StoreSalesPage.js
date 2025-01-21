import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Table, Card, message, Space, Tag } from 'antd';
import { salesApi } from '../services/api';

const StoreSalesPage = () => {
    const { storeId } = useParams();
    const [loading, setLoading] = useState(false);
    const [sales, setSales] = useState([]);

    useEffect(() => {
        const fetchSales = async () => {
            try {
                setLoading(true);
                const response = await salesApi.getSales(storeId);
                if (response?.success) {
                    setSales(response.sales);
                }
            } catch (error) {
                console.error('Error fetching sales:', error);
                message.error('Failed to load sales data');
            } finally {
                setLoading(false);
            }
        };

        fetchSales();
    }, [storeId]);

    const columns = [
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
            render: (price) => `$${price}`
        },
        {
            title: 'Sale Date',
            dataIndex: 'sale_date',
            key: 'sale_date',
            width: 150,
            render: (date) => new Date(date).toLocaleString()
        },
        {
            title: 'Notes',
            dataIndex: 'notes',
            key: 'notes'
        }
    ];

    return (
        <div>
            <Card title="Sales Records">
                <Table
                    columns={columns}
                    dataSource={sales}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 1000 }}
                    pagination={{
                        showSizeChanger: true,
                        showQuickJumper: true,
                        pageSizeOptions: ['10', '20', '50']
                    }}
                />
            </Card>
        </div>
    );
};

export default StoreSalesPage; 