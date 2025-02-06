import React, { useState, useEffect } from 'react';
import { 
    Card, 
    Descriptions, 
    Button, 
    Space, 
    message,
    Table,
    Spin,
    Tabs,
    Tag,
    Typography,
    Statistic
} from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import moment from 'moment';
import poService from '../services/poService';

const { TabPane } = Tabs;
const { Title } = Typography;

const PODetailPage = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [poData, setPOData] = useState(null);

    useEffect(() => {
        const fetchPOData = async () => {
            try {
                setLoading(true);
                const response = await poService.getPOById(id);
                if (response?.data?.success) {
                    setPOData(response.data.data);
                    console.log('PO Data:', response.data.data);  // 添加日誌
                }
            } catch (error) {
                console.error('Error fetching PO data:', error);
                message.error('Failed to load PO data');
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchPOData();
        }
    }, [id]);

    const handleEdit = () => {
        navigate(`/inbound/purchase-order/edit/${id}`);
    };

    const getStatusColor = (status) => {
        if (!status) return 'default';  // Handle undefined or null status
        
        switch (status.toLowerCase()) {
            case 'draft':
                return 'default';
            case 'pending':
                return 'processing';
            case 'completed':
                return 'success';
            case 'cancelled':
                return 'error';
            default:
                return 'default';
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
        // Add all category columns
        ...(poData?.categories || []).map(category => ({
            title: category.name,
            key: `category_${category.id}`,
            width: 120,
            render: (_, record) => {
                const categoryData = record.categories?.find(cat => 
                    cat && cat.category_id === category.id
                );
                return categoryData ? (
                    <Tag color="blue">{categoryData.tag_name}</Tag>
                ) : '-';
            }
        })),
        {
            title: 'Cost',
            dataIndex: 'cost',
            key: 'cost',
            width: 100,
            fixed: 'right',
            render: (cost) => `$ ${Number(cost).toFixed(2)}`
        },
        {
            title: 'SO',
            dataIndex: 'so',
            key: 'so',
            width: 100,
            fixed: 'right'
        },
        {
            title: 'Note',
            dataIndex: 'note',
            key: 'note',
            width: 150,
            fixed: 'right'
        }
    ];

    if (loading) {
        return (
            <div style={{ padding: 24, textAlign: 'center' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div style={{ padding: 24 }}>
            <Card 
                title={
                    <Space size="middle">
                        <span>Purchase Order Details</span>
                        <Tag color={getStatusColor(poData?.order?.status)}>
                            {poData?.order?.status?.toUpperCase()}
                        </Tag>
                    </Space>
                }
                extra={
                    <Button onClick={() => navigate('/inbound/purchase-order', { 
                        replace: true,
                        state: { activeTab: 'inbound-po' }
                    })}>
                        Back
                    </Button>
                }
            >
                {poData?.order && (
                    <>
                        <Descriptions bordered column={2}>
                            <Descriptions.Item label="PO Number">
                                {poData.order.po_number}
                            </Descriptions.Item>
                            <Descriptions.Item label="Date">
                                {moment(poData.order.order_date).format('YYYY-MM-DD')}
                            </Descriptions.Item>
                            <Descriptions.Item label="Supplier">
                                {poData.order.supplier}
                            </Descriptions.Item>
                            <Descriptions.Item label="Total Amount">
                                <Statistic 
                                    value={poData.order.total_amount} 
                                    precision={2} 
                                    prefix="$"
                                    valueStyle={{ color: '#cf1322' }}
                                />
                            </Descriptions.Item>
                            <Descriptions.Item label="Note">
                                {poData.order.notes || '-'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Total Items">
                                {poData.items?.length || 0}
                            </Descriptions.Item>
                        </Descriptions>

                        <div style={{ marginTop: 24 }}>
                            <Title level={4}>Order Details</Title>
                            <Table
                                dataSource={poData.items}
                                columns={columns}
                                pagination={false}
                                rowKey="id"
                                scroll={{ x: 'max-content' }}
                                summary={pageData => {
                                    const total = pageData.reduce(
                                        (sum, item) => sum + Number(item.cost),
                                        0
                                    );
                                    const categoryCount = poData?.categories?.length || 0;
                                    return (
                                        <Table.Summary.Row>
                                            <Table.Summary.Cell index={0} colSpan={categoryCount + 1}>
                                                <strong>Total</strong>
                                            </Table.Summary.Cell>
                                            <Table.Summary.Cell index={categoryCount + 1}>
                                                <strong>$ {total.toFixed(2)}</strong>
                                            </Table.Summary.Cell>
                                            <Table.Summary.Cell index={categoryCount + 2} colSpan={2} />
                                        </Table.Summary.Row>
                                    );
                                }}
                            />
                        </div>
                    </>
                )}
            </Card>
        </div>
    );
};

export default PODetailPage; 