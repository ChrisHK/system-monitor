import React, { useState, useEffect, useCallback } from 'react';
import { Table, Input, Button, message, Row, Col, Tag, Popconfirm } from 'antd';
import { SearchOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { getStoreItems, deleteStoreItem, exportStoreItems } from '../services/api';

const { Search } = Input;

const StorePage = () => {
    const { storeId } = useParams();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [filteredRecords, setFilteredRecords] = useState([]);

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

    const handleSearch = useCallback((value) => {
        const searchValue = value.toLowerCase().trim();
        setSearchText(value);
        
        if (!searchValue) {
            setFilteredRecords([]);
            return;
        }
        
        const filtered = records.filter(record => 
            Object.values(record)
                .some(val => 
                    val && 
                    val.toString().toLowerCase().includes(searchValue)
                )
        );
        
        setFilteredRecords(filtered);
        
        if (filtered.length === 0 && searchValue) {
            message.info('No matching records found in this store');
        }
    }, [records]);

    const fetchStoreItems = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getStoreItems(storeId);

            if (response?.data?.success) {
                setRecords(response.data.items || []);
                // Clear filtered records when fetching new data
                setFilteredRecords([]);
                setSearchText('');
            } else {
                console.warn('Invalid response format:', response);
                message.error('Failed to fetch items: Invalid response format');
            }
        } catch (error) {
            console.error('Error fetching store items:', error);
            message.error(`Failed to fetch items: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        fetchStoreItems();
    }, [fetchStoreItems]);

    const handleDelete = async (recordId) => {
        try {
            setLoading(true);
            const response = await deleteStoreItem(storeId, recordId);

            if (response?.data?.success) {
                message.success('Item deleted successfully');
                await fetchStoreItems();
            } else {
                throw new Error(response?.data?.error || 'Failed to delete item');
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            message.error(`Failed to delete item: ${error.response?.data?.error || error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            setLoading(true);
            const csvData = await exportStoreItems(storeId);
            
            // Create blob and download
            const blob = new Blob([csvData], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `store-items-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            message.success('Export completed');
        } catch (error) {
            message.error(`Failed to export: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col flex="auto">
                    <Input.Group compact style={{ display: 'flex' }}>
                        <Search
                            placeholder="Search in current store..."
                            allowClear
                            enterButton={<SearchOutlined />}
                            onSearch={handleSearch}
                            value={searchText}
                            onChange={(e) => handleSearch(e.target.value)}
                            style={{ flex: 1 }}
                        />
                        <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            onClick={handleExport}
                            loading={loading}
                        >
                            Export
                        </Button>
                    </Input.Group>
                </Col>
            </Row>

            <Table
                columns={columns}
                dataSource={searchText ? filteredRecords : records}
                rowKey="id"
                loading={loading}
                scroll={{ x: 1500 }}
                pagination={{
                    total: (searchText ? filteredRecords : records).length,
                    pageSize: 20,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    pageSizeOptions: ['20', '50', '100'],
                    defaultPageSize: 20
                }}
                summary={pageData => {
                    const total = pageData.length;
                    return (
                        <Table.Summary fixed>
                            <Table.Summary.Row>
                                <Table.Summary.Cell index={0} colSpan={columns.length}>
                                    Total Records: {total}
                                </Table.Summary.Cell>
                            </Table.Summary.Row>
                        </Table.Summary>
                    );
                }}
            />
        </div>
    );
};

export default StorePage; 