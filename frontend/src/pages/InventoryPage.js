import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Input, Button, message, Popconfirm, Space, Tag, Row, Col, Select } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Search } = Input;
const { Option } = Select;

const InventoryPage = () => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [duplicateSerials, setDuplicateSerials] = useState(new Set());
    const [searchText, setSearchText] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [filteredRecords, setFilteredRecords] = useState([]);

    const API_BASE_URL = 'http://192.168.0.10:3000';

    const branches = [
        { value: 'all', label: 'All Stores' },
        { value: 'main-store', label: 'Main Store' },
        { value: 'fmp-store', label: 'FMP Store' },
        { value: 'mississauga-store', label: 'Mississauga Store' }
    ];

    const fetchRecords = useCallback(async () => {
        try {
            setLoading(true);
            const [recordsResponse, duplicatesResponse] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/records`, {
                    params: {
                        branch: selectedBranch !== 'all' ? selectedBranch : undefined
                    },
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000,
                    withCredentials: true
                }),
                axios.get(`${API_BASE_URL}/api/records/duplicates`, {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    timeout: 5000,
                    withCredentials: true
                })
            ]);

            if (recordsResponse.data.success) {
                const newRecords = recordsResponse.data.records;
                
                // Get duplicates from backend
                const duplicatesList = duplicatesResponse.data.success ? 
                    duplicatesResponse.data.duplicates.map(d => d.serialnumber) : [];
                
                setDuplicateSerials(new Set(duplicatesList));
                setRecords(newRecords);
            }
        } catch (error) {
            console.error('Error fetching records:', error);
            message.error(`Failed to fetch records: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, [API_BASE_URL, selectedBranch]);

    const handleDelete = useCallback(async (record) => {
        // Safety checks
        if (!record || !record.id) {
            message.error('Invalid record to delete');
            return;
        }

        if (!record.serialnumber || !duplicateSerials.has(record.serialnumber)) {
            message.error('Can only delete duplicate records');
            return;
        }

        try {
            setLoading(true);
            console.log('Attempting to delete record:', {
                id: record.id,
                serialNumber: record.serialnumber,
                computerName: record.computername
            });

            const response = await axios.delete(`${API_BASE_URL}/api/records/${record.id}`, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 5000,
                withCredentials: true
            });

            if (response.data.success) {
                message.success(`Record with serial ${record.serialnumber} deleted successfully`);
                // Refresh the records to update the list
                await fetchRecords();
            } else {
                throw new Error(response.data.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Error deleting record:', error);
            
            // Handle specific error cases
            if (error.response) {
                switch (error.response.status) {
                    case 404:
                        message.error(`Record not found. It may have been already deleted.`);
                        // Refresh to get latest data
                        await fetchRecords();
                        break;
                    case 403:
                        message.error('You do not have permission to delete this record');
                        break;
                    default:
                        message.error(`Failed to delete record: ${error.response.data?.error || error.message}`);
                }
            } else if (error.request) {
                message.error('Network error. Please check your connection.');
            } else {
                message.error(`Failed to delete record: ${error.message}`);
            }
        } finally {
            setLoading(false);
        }
    }, [API_BASE_URL, duplicateSerials, fetchRecords]);

    const columns = useMemo(() => [
        {
            title: 'Serial Number',
            dataIndex: 'serialnumber',
            key: 'serialnumber',
            width: 150,
            filterable: true,
            render: (text, record) => (
                <span>
                    {text}
                    {duplicateSerials.has(text) && (
                        <Tag color="red" style={{ marginLeft: 8 }}>
                            Duplicate
                        </Tag>
                    )}
                </span>
            )
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
                // Remove text in parentheses and extra spaces
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
                // Take only the part before [
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
            title: 'Created Time',
            dataIndex: 'created_at',
            key: 'created_at',
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
                <Space size="middle">
                    {duplicateSerials.has(record.serialnumber) && (
                        <Popconfirm
                            title="Delete this record?"
                            onConfirm={() => handleDelete(record)}
                            okText="Yes"
                            cancelText="No"
                        >
                            <Button danger type="link">Delete</Button>
                        </Popconfirm>
                    )}
                </Space>
            )
        }
    ], [duplicateSerials, handleDelete]);

    const handleSearch = useCallback((value, dataSource = records) => {
        const searchValue = value.toLowerCase();
        setSearchText(value);
        
        // Ensure dataSource is an array
        const dataArray = Array.isArray(dataSource) ? dataSource : [];
        
        const filtered = dataArray.filter(record => {
            if (!record) return false;
            return Object.entries(record).some(([key, val]) => {
                if (columns.find(col => col.dataIndex === key && col.filterable)) {
                    return val && val.toString().toLowerCase().includes(searchValue);
                }
                return false;
            });
        });
        
        setFilteredRecords(filtered);
    }, [columns, records]);

    // Effect for search when records or search text changes
    useEffect(() => {
        if (records.length > 0 || searchText) {
            handleSearch(searchText, records);
        }
    }, [records, searchText, handleSearch]);

    const handleBranchChange = useCallback((value) => {
        setSelectedBranch(value);
    }, []);

    // Effect for initial fetch and branch changes
    useEffect(() => {
        fetchRecords();
    }, [selectedBranch, fetchRecords]);

    const handleRefresh = () => {
        fetchRecords();
    };

    return (
        <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Search
                        placeholder="Search inventory..."
                        allowClear
                        enterButton={<SearchOutlined />}
                        onSearch={(value) => handleSearch(value, records)}
                        onChange={(e) => handleSearch(e.target.value, records)}
                        style={{ width: '100%' }}
                    />
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Select
                        value={selectedBranch}
                        onChange={handleBranchChange}
                        style={{ width: '100%' }}
                    >
                        {branches.map(branch => (
                            <Option key={branch.value} value={branch.value}>
                                {branch.label}
                            </Option>
                        ))}
                    </Select>
                </Col>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Button
                        icon={<ReloadOutlined />}
                        onClick={handleRefresh}
                        loading={loading}
                    >
                        Refresh
                    </Button>
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
            />
        </div>
    );
};

export default InventoryPage; 