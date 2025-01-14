import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { Table, Input, Button, message, Popconfirm, Space, Tag, Row, Col, Select, Card, Statistic, Modal, Form } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { 
    getInventoryRecords, 
    getDuplicateRecords, 
    updateRecord,
    deleteRecord,
    checkItemLocation
} from '../services/api';

const { Search } = Input;
const { Option } = Select;

const branches = [
    { value: 'all', label: 'All Stores' },
    { value: 'main-store', label: 'Main Store' },
    { value: 'fmp-store', label: 'FMP Store' },
    { value: 'mississauga-store', label: 'Mississauga Store' }
];

const InventoryPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { "*": storeId } = useParams();
    const { logout } = useAuth();
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [duplicateSerials, setDuplicateSerials] = useState(new Set());
    const [searchText, setSearchText] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('all');
    const [filteredRecords, setFilteredRecords] = useState([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [form] = Form.useForm();
    const [itemLocations, setItemLocations] = useState({});

    useEffect(() => {
        const path = location.pathname;
        if (path.startsWith('/stores/')) {
            const id = path.split('/')[2];
            setSelectedBranch(id);
        } else {
            setSelectedBranch('all');
        }
    }, [location.pathname]);

    const handleSessionExpired = useCallback(() => {
        message.error('Session expired. Please login again.');
        logout();
        navigate('/login');
    }, [logout, navigate]);

    const fetchRecords = useCallback(async () => {
        try {
            setLoading(true);
            const params = {};
            if (storeId && storeId !== 'all') {
                params.store_id = storeId;
            }

            const recordsResponse = await getInventoryRecords(params);
            if (recordsResponse?.data?.success) {
                const newRecords = recordsResponse.data.records;
                setRecords(newRecords);
                setFilteredRecords(newRecords);
                setTotalRecords(newRecords.length);

                // Fetch locations for all records
                const locationPromises = newRecords.map(record => 
                    checkItemLocation(record.serialnumber)
                        .catch(error => {
                            console.warn(`Failed to check location for ${record.serialnumber}:`, error);
                            return { data: { success: true, location: 'unknown' } };
                        })
                );

                const locations = await Promise.all(locationPromises);
                const locationMap = {};
                locations.forEach((loc, index) => {
                    if (loc?.data?.success) {
                        locationMap[newRecords[index].serialnumber] = loc.data;
                    }
                });
                setItemLocations(locationMap);

                try {
                    const duplicatesResponse = await getDuplicateRecords();
                    if (duplicatesResponse?.data?.success) {
                        const duplicatesList = duplicatesResponse.data.duplicates.map(d => d.serialnumber);
                        setDuplicateSerials(new Set(duplicatesList));
                    }
                } catch (duplicateError) {
                    console.error('Failed to fetch duplicates:', duplicateError);
                    setDuplicateSerials(new Set());
                }
            }
        } catch (error) {
            console.error('Error fetching records:', error);
            if (error.response?.status === 401) {
                handleSessionExpired();
            } else {
                message.error('Failed to fetch records. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }, [storeId, handleSessionExpired]);

    const handleEdit = useCallback((record) => {
        setEditingRecord(record);
        form.setFieldsValue(record);
        setEditModalVisible(true);
    }, [form]);

    const handleDelete = useCallback(async (recordId) => {
        if (!recordId) {
            message.error('Invalid record to delete');
            return;
        }

        try {
            const response = await deleteRecord(recordId);
            if (response.data.success) {
                message.success('Record deleted successfully');
                fetchRecords();
            }
        } catch (error) {
            console.error('Delete failed:', error);
            message.error('Failed to delete record');
        }
    }, [fetchRecords]);

    const columns = useMemo(() => [
        {
            title: 'Location',
            dataIndex: 'serialnumber',
            key: 'location',
            width: 120,
            render: (serialnumber) => {
                const location = itemLocations[serialnumber];
                if (!location) {
                    return <Tag color="default">Unknown</Tag>;
                }
                if (location.location === 'store') {
                    return (
                        <Tag color="blue" style={{ minWidth: '80px', textAlign: 'center' }}>
                            {location.storeName || 'Store'}
                        </Tag>
                    );
                }
                if (location.location === 'inventory') {
                    return (
                        <Tag color="green" style={{ minWidth: '80px', textAlign: 'center' }}>
                            Inventory
                        </Tag>
                    );
                }
                return (
                    <Tag color="default" style={{ minWidth: '80px', textAlign: 'center' }}>
                        {location.location || 'Unknown'}
                    </Tag>
                );
            }
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
            ),
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
                    <Button type="link" onClick={() => handleEdit(record)}>
                        Edit
                    </Button>
                    {duplicateSerials.has(record.serialnumber) && (
                        <Popconfirm
                            title="Delete this record?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Yes"
                            cancelText="No"
                        >
                            <Button danger type="link">Delete</Button>
                        </Popconfirm>
                    )}
                </Space>
            )
        }
    ], [itemLocations, duplicateSerials, handleDelete, handleEdit]);

    const handleSearch = useCallback((value) => {
        const searchValue = value.toLowerCase();
        setSearchText(value);
        
        if (!searchValue) {
            setFilteredRecords(records);
            return;
        }
        
        const filtered = records.filter(record => {
            if (!record) return false;
            return Object.entries(record).some(([key, val]) => {
                if (columns.find(col => col.dataIndex === key && col.filterable)) {
                    return val && val.toString().toLowerCase().includes(searchValue);
                }
                return false;
            });
        });
        
        setFilteredRecords(filtered);
    }, [records, columns]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    useEffect(() => {
        if (searchText) {
            handleSearch(searchText);
        }
    }, [searchText, handleSearch]);

    const handleEditSubmit = async () => {
        try {
            const values = await form.validateFields();
            const response = await updateRecord(editingRecord.id, values);
            if (response.data.success) {
                message.success('Record updated successfully');
                setEditModalVisible(false);
                fetchRecords();
            }
        } catch (error) {
            console.error('Update failed:', error);
            message.error('Failed to update record');
        }
    };

    const getStoreCount = useCallback((storeName) => {
        return Object.values(itemLocations).filter(location => 
            location?.location === 'store' && 
            location?.storeName?.toLowerCase().includes(storeName.toLowerCase().replace('-store', ''))
        ).length;
    }, [itemLocations]);

    return (
        <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col span={24}>
                    <Card>
                        <Row gutter={16}>
                            <Col span={6}>
                                <Statistic
                                    title="Total Records"
                                    value={totalRecords}
                                    style={{ marginBottom: 16 }}
                                />
                            </Col>
                            <Col span={6}>
                                <Statistic
                                    title="Main Store"
                                    value={getStoreCount('main-store')}
                                    style={{ marginBottom: 16 }}
                                />
                            </Col>
                            <Col span={6}>
                                <Statistic
                                    title="FMP Store"
                                    value={getStoreCount('fmp-store')}
                                    style={{ marginBottom: 16 }}
                                />
                            </Col>
                            <Col span={6}>
                                <Statistic
                                    title="Mississauga Store"
                                    value={getStoreCount('mississauga-store')}
                                    style={{ marginBottom: 16 }}
                                />
                            </Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={24}>
                                <Space>
                                    <Select
                                        style={{ width: 200 }}
                                        value={selectedBranch}
                                        onChange={setSelectedBranch}
                                    >
                                        {branches.map(branch => (
                                            <Option key={branch.value} value={branch.value}>
                                                {branch.label}
                                            </Option>
                                        ))}
                                    </Select>
                                    <Search
                                        placeholder="Search records..."
                                        allowClear
                                        enterButton={<SearchOutlined />}
                                        onSearch={handleSearch}
                                        style={{ width: 300 }}
                                    />
                                    <Button
                                        icon={<ReloadOutlined />}
                                        onClick={fetchRecords}
                                        loading={loading}
                                    >
                                        Refresh
                                    </Button>
                                </Space>
                            </Col>
                        </Row>
                    </Card>
                </Col>

                <Col span={24}>
                    <Table
                        columns={columns}
                        dataSource={filteredRecords}
                        rowKey="id"
                        loading={loading}
                        scroll={{ x: 1500 }}
                        pagination={{
                            total: filteredRecords.length,
                            pageSize: 20,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            pageSizeOptions: ['20', '50', '100']
                        }}
                        summary={pageData => {
                            return (
                                <Table.Summary fixed>
                                    <Table.Summary.Row>
                                        <Table.Summary.Cell index={0} colSpan={columns.length}>
                                            Total Records: {totalRecords} | Main Store: {getStoreCount('main-store')} | FMP Store: {getStoreCount('fmp-store')} | Mississauga Store: {getStoreCount('mississauga-store')}
                                        </Table.Summary.Cell>
                                    </Table.Summary.Row>
                                </Table.Summary>
                            );
                        }}
                    />
                </Col>
            </Row>

            <Modal
                title="Edit Record"
                open={editModalVisible}
                onOk={handleEditSubmit}
                onCancel={() => {
                    setEditModalVisible(false);
                    form.resetFields();
                }}
            >
                <Form
                    form={form}
                    layout="vertical"
                >
                    <Form.Item
                        name="serialnumber"
                        label="Serial Number"
                        rules={[{ required: true, message: 'Please input serial number!' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="computername"
                        label="Computer Name"
                        rules={[{ required: true, message: 'Please input computer name!' }]}
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="manufacturer"
                        label="Manufacturer"
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="model"
                        label="Model"
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="systemsku"
                        label="System SKU"
                    >
                        <Input />
                    </Form.Item>
                    <Form.Item
                        name="operatingsystem"
                        label="Operating System"
                    >
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default InventoryPage; 