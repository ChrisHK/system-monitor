import React, { useState, useEffect } from 'react';
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

    const columns = [
        {
            title: 'System SKU',
            dataIndex: 'systemsku',
            key: 'systemsku',
            width: 150,
            filterable: true
        },
        {
            title: 'Serial Number',
            dataIndex: 'serialnumber',
            key: 'serialnumber',
            width: 150,
            filterable: true,
            render: (text) => (
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
            width: 150
        },
        {
            title: 'Manufacturer',
            dataIndex: 'manufacturer',
            key: 'manufacturer',
            width: 120
        },
        {
            title: 'Model',
            dataIndex: 'model',
            key: 'model',
            width: 150
        },
        {
            title: 'OS',
            dataIndex: 'os',
            key: 'os',
            width: 200
        },
        {
            title: 'CPU',
            dataIndex: 'cpu',
            key: 'cpu',
            width: 200
        },
        {
            title: 'RAM (GB)',
            dataIndex: 'ram_gb',
            key: 'ram_gb',
            width: 100
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
            title: 'Actions',
            key: 'actions',
            fixed: 'right',
            width: 100,
            render: (_, record) => (
                <Space size="middle">
                    <Popconfirm
                        title="Delete this record?"
                        onConfirm={() => handleDelete(record)}
                        okText="Yes"
                        cancelText="No"
                    >
                        <Button danger type="link">Delete</Button>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    const fetchRecords = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_BASE_URL}/api/records`, {
                params: {
                    branch: selectedBranch !== 'all' ? selectedBranch : undefined
                },
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 5000,
                withCredentials: true
            });

            if (response.data.success) {
                const records = response.data.records;
                setRecords(records);
                handleSearch(searchText, records);
                
                // Find duplicate serials
                const serialCounts = {};
                records.forEach(record => {
                    if (record.serialnumber) {
                        serialCounts[record.serialnumber] = (serialCounts[record.serialnumber] || 0) + 1;
                    }
                });
                
                const duplicates = new Set(
                    Object.entries(serialCounts)
                        .filter(([_, count]) => count > 1)
                        .map(([serial]) => serial)
                );
                
                setDuplicateSerials(duplicates);
            }
        } catch (error) {
            console.error('Error fetching records:', error);
            message.error(`Failed to fetch records: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (value, dataSource = records) => {
        const searchValue = value.toLowerCase();
        setSearchText(value);
        
        const filtered = dataSource.filter(record => {
            return Object.entries(record).some(([key, val]) => {
                if (columns.find(col => col.dataIndex === key && col.filterable)) {
                    return val && val.toString().toLowerCase().includes(searchValue);
                }
                return false;
            });
        });
        
        setFilteredRecords(filtered);
    };

    const handleBranchChange = (value) => {
        setSelectedBranch(value);
        fetchRecords();
    };

    const handleDelete = async (record) => {
        try {
            setLoading(true);
            console.log('Deleting record:', record.id);

            const response = await axios.delete(`${API_BASE_URL}/api/records/${record.id}`, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 5000,
                withCredentials: true
            });

            if (response.data.success) {
                message.success('Record deleted successfully');
                fetchRecords();
            }
        } catch (error) {
            console.error('Error deleting record:', error);
            message.error(`Failed to delete record: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, [selectedBranch]);

    return (
        <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={12} md={8} lg={6}>
                    <Search
                        placeholder="Search inventory..."
                        allowClear
                        enterButton={<SearchOutlined />}
                        onSearch={handleSearch}
                        onChange={(e) => handleSearch(e.target.value)}
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
                        onClick={() => fetchRecords()}
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