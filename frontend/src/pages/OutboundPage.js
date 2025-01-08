import React, { useState, useEffect } from 'react';
import { Table, Button, Select, Input, message, Row, Col } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;
const { Search } = Input;
const API_BASE_URL = process.env.REACT_APP_API_URL;

const OutboundPage = () => {
    const [records, setRecords] = useState([]);
    const [stores, setStores] = useState([]);
    const [selectedStore, setSelectedStore] = useState(null);
    const [selectedRecords, setSelectedRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchField, setSearchField] = useState('system_sku');
    const [searchText, setSearchText] = useState('');

    // Fetch stores
    const fetchStores = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/stores`);
            if (response.data.success) {
                setStores(response.data.stores);
            }
        } catch (error) {
            console.error('Error fetching stores:', error);
            message.error('Failed to fetch stores');
        }
    };

    // Fetch records with search
    const fetchRecords = async (searchParams = {}) => {
        try {
            setLoading(true);
            let url = `${API_BASE_URL}/records`;
            
            // Add search parameters if they exist
            if (searchParams.field && searchParams.term) {
                url = `${API_BASE_URL}/records/search?field=${encodeURIComponent(searchParams.field)}&term=${encodeURIComponent(searchParams.term)}`;
            }
            
            const response = await axios.get(url);
            if (response.data.success) {
                setRecords(response.data.records);
            }
        } catch (error) {
            console.error('Error fetching records:', error);
            message.error('Failed to fetch records');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStores();
        fetchRecords();
    }, []);

    // Handle search
    const handleSearch = (value) => {
        if (!searchField) {
            message.warning('Please select a search field');
            return;
        }
        
        if (value) {
            fetchRecords({ field: searchField, term: value });
        } else {
            fetchRecords(); // Reset to show all records
        }
        setSearchText(value);
    };

    // Handle sending records to store
    const handleSendToStore = async () => {
        if (!selectedStore) {
            message.warning('Please select a store first');
            return;
        }
        if (selectedRecords.length === 0) {
            message.warning('Please select records to send');
            return;
        }

        try {
            setLoading(true);
            const response = await axios.post(`${API_BASE_URL}/store-outbound`, {
                storeId: selectedStore,
                recordIds: selectedRecords
            });

            if (response.data.success) {
                message.success('Records sent to store successfully');
                setSelectedRecords([]);
                fetchRecords();
            }
        } catch (error) {
            console.error('Error sending records to store:', error);
            message.error(error.response?.data?.error || 'Failed to send records to store');
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'System SKU',
            dataIndex: 'system_sku',
            key: 'system_sku'
        },
        {
            title: 'OS',
            dataIndex: 'os',
            key: 'os'
        },
        {
            title: 'CPU',
            dataIndex: 'cpu',
            key: 'cpu'
        },
        {
            title: 'RAM (GB)',
            dataIndex: 'ram_gb',
            key: 'ram_gb'
        },
        {
            title: 'Battery Health',
            dataIndex: 'battery_health',
            key: 'battery_health',
            render: (health) => {
                const value = parseFloat(health);
                let color = 'green';
                if (value < 80) color = 'orange';
                if (value < 60) color = 'red';
                return <span style={{ color }}>{health}%</span>;
            }
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <Row gutter={[16, 16]}>
                <Col span={8}>
                    <Select
                        style={{ width: '100%' }}
                        placeholder="Select a store"
                        onChange={setSelectedStore}
                        value={selectedStore}
                    >
                        {stores.map(store => (
                            <Option key={store.id} value={store.id}>{store.name}</Option>
                        ))}
                    </Select>
                </Col>
                <Col span={8}>
                    <Select
                        style={{ width: '100%' }}
                        placeholder="Search by"
                        value={searchField}
                        onChange={setSearchField}
                    >
                        <Option value="system_sku">System SKU</Option>
                        <Option value="serialnumber">Serial Number</Option>
                        <Option value="model">Model</Option>
                    </Select>
                </Col>
                <Col span={8}>
                    <Search
                        placeholder="Search records..."
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        onSearch={handleSearch}
                        enterButton={<SearchOutlined />}
                        allowClear
                    />
                </Col>
            </Row>

            <Row style={{ marginTop: '16px', marginBottom: '16px' }}>
                <Col>
                    <Button
                        type="primary"
                        onClick={handleSendToStore}
                        disabled={!selectedStore || selectedRecords.length === 0}
                        loading={loading}
                    >
                        Send to Store
                    </Button>
                </Col>
            </Row>

            <Table
                columns={columns}
                dataSource={records}
                rowKey="id"
                loading={loading}
                rowSelection={{
                    selectedRowKeys: selectedRecords,
                    onChange: (selectedRowKeys) => {
                        setSelectedRecords(selectedRowKeys);
                    }
                }}
            />
        </div>
    );
};

export default OutboundPage; 