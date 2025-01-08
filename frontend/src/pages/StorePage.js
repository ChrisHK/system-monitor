import React, { useState, useEffect, useCallback } from 'react';
import { Table, message, Tag, Row, Col, Button, Popconfirm } from 'antd';
import { DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { getStoreItems, deleteStoreItem, exportStoreItems } from '../services/api';

const StorePage = () => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const { storeId } = useParams();

    const handleDelete = async (itemId) => {
        try {
            setLoading(true);
            const response = await deleteStoreItem(storeId, itemId);
            if (response.success) {
                message.success('Item deleted successfully');
                await fetchStoreItems();
            }
        } catch (error) {
            message.error(`Failed to delete item: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCSV = async () => {
        try {
            setLoading(true);
            const response = await exportStoreItems(storeId);
            
            // Create blob from the response
            const blob = new Blob([response], { type: 'text/csv' });
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `store-items-${new Date().toISOString().split('T')[0]}.csv`);
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            
            // Cleanup
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            message.success('CSV file exported successfully');
        } catch (error) {
            message.error(`Failed to export CSV: ${error.message}`);
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
            filterable: true
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
            width: 100,
            render: (value) => value ? 'Yes' : 'No'
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
            render: (text) => text || 'N/A'
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
            title: 'Received Time',
            dataIndex: 'received_at',
            key: 'received_at',
            width: 150,
            render: (text) => {
                if (!text) return 'N/A';
                return new Date(text).toLocaleString();
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 100,
            render: (_, record) => (
                <Popconfirm
                    title="Delete this item?"
                    onConfirm={() => handleDelete(record.id)}
                    okText="Yes"
                    cancelText="No"
                >
                    <Button type="link" danger icon={<DeleteOutlined />}>
                        Delete
                    </Button>
                </Popconfirm>
            )
        }
    ];

    const fetchStoreItems = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getStoreItems(storeId);

            if (response.success) {
                setRecords(response.items || []);
            }
        } catch (error) {
            console.error('Error fetching store items:', error);
            message.error(`Failed to fetch items: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        if (storeId) {
            fetchStoreItems();
        }
    }, [storeId, fetchStoreItems]);

    return (
        <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <span style={{ marginRight: 8 }}>
                        Total Items: {records.length}
                    </span>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Button
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handleExportCSV}
                        loading={loading}
                    >
                        Export CSV
                    </Button>
                </Col>
            </Row>

            <Table
                columns={columns}
                dataSource={records}
                rowKey="id"
                loading={loading}
                scroll={{ x: 1500 }}
                pagination={{
                    total: records.length,
                    pageSize: 20,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    pageSizeOptions: ['20', '50', '100'],
                    defaultPageSize: 20
                }}
            />
        </div>
    );
};

export default StorePage; 