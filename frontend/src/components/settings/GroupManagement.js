import React, { useState, useEffect } from 'react';
import { 
    Table, 
    Button, 
    Modal, 
    Form, 
    Input, 
    Select, 
    message, 
    Space, 
    Tag, 
    Tooltip,
    Typography,
    Checkbox,
    Alert,
    Card,
    Divider,
    Row,
    Col
} from 'antd';
import { 
    EditOutlined, 
    PlusOutlined,
    QuestionCircleOutlined,
    DeleteOutlined,
    LockOutlined
} from '@ant-design/icons';
import { userService, storeService } from '../../api';

const { Option } = Select;
const { TextArea } = Input;
const { Title } = Typography;

const DEFAULT_GROUPS = [
    {
        id: 1,
        name: 'admin',
        description: 'Administrator group with full access',
        permitted_stores: [], // All stores
        main_permissions: {
            inventory: true,
            inventory_ram: true,
            outbound: true,
            inbound: true,
            purchase_order: true,
            tag_management: true
        },
        store_permissions: {},
        is_system: true
    }
];

const ensureAdminPermissions = (group) => {
    if (group.name === 'admin') {
        return {
            ...group,
            main_permissions: {
                inventory: true,
                inventory_ram: true,
                outbound: true,
                inbound: true,
                purchase_order: true,
                tag_management: true
            },
            // Admin has access to all stores with full permissions
            store_permissions: Object.fromEntries(
                (group.permitted_stores || []).map(storeId => [
                    storeId,
                    {
                        inventory: true,
                        orders: true,
                        rma: true,
                        outbound: true
                    }
                ])
            )
        };
    }
    return group;
};

const GroupManagement = () => {
    const [groups, setGroups] = useState([]);
    const [stores, setStores] = useState([]);
    const [editingGroup, setEditingGroup] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [form] = Form.useForm();
    const [selectedStores, setSelectedStores] = useState([]);
    
    // 將 Form.useWatch 移到組件頂層
    const watchedStores = Form.useWatch('stores', form) || [];

    const fetchGroups = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await userService.getGroups();
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to load groups');
            }
            
            const groupsList = response.data?.groups || response.groups;
            if (!Array.isArray(groupsList)) {
                throw new Error('Invalid groups data format');
            }
            
            // Ensure admin group has full permissions
            const processedGroups = groupsList.map(group => ensureAdminPermissions(group));
            
            // Merge with default admin group if not present
            const adminGroup = processedGroups.find(g => g.name === 'admin');
            const updatedGroups = adminGroup 
                ? processedGroups 
                : [...DEFAULT_GROUPS, ...processedGroups];
            
            setGroups(updatedGroups);
        } catch (error) {
            console.error('Error fetching groups:', error);
            setError(error.message);
            message.error('Failed to load groups');
            // Fallback to default admin group
            setGroups(DEFAULT_GROUPS);
        } finally {
            setLoading(false);
        }
    };

    const fetchStores = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await storeService.getStores();
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to load stores');
            }
            
            const storesList = response.data?.stores || response.stores;
            if (!Array.isArray(storesList)) {
                throw new Error('Invalid stores data format');
            }
            
            setStores(storesList);
        } catch (error) {
            console.error('Error fetching stores:', error);
            setError(error.message);
            message.error('Failed to load stores');
            setStores([]);
        } finally {
            setLoading(false);
        }
    };

    // Initialize data
    useEffect(() => {
        const initData = async () => {
            try {
                setLoading(true);
                setError(null);
                await Promise.all([
                    fetchGroups(),
                    fetchStores()
                ]);
            } catch (error) {
                console.error('Error initializing data:', error);
                setError(error.message || 'Failed to initialize data');
            } finally {
                setLoading(false);
            }
        };
        initData();
    }, []);

    // 監聽 permitted_stores 的變化
    const handleStoreSelect = (values) => {
        setSelectedStores(values);
        const currentPermissions = form.getFieldValue('store_permissions') || {};

        // 找出新增的商店
        const newStores = values.filter(storeId => !selectedStores.includes(storeId));

        // 只為新增的商店設置默認權限
        const updatedPermissions = {
            ...currentPermissions,
            ...newStores.reduce((acc, storeId) => {
                const storePrefix = `store_${storeId}_`;
                acc[`${storePrefix}inventory`] = false;
                acc[`${storePrefix}orders`] = false;
                acc[`${storePrefix}rma`] = false;
                acc[`${storePrefix}outbound`] = false;
                return acc;
            }, {})
        };

        // 移除不再選中的商店的權限
        const removedStores = selectedStores.filter(storeId => !values.includes(storeId));
        removedStores.forEach(storeId => {
            const storePrefix = `store_${storeId}_`;
            delete updatedPermissions[`${storePrefix}inventory`];
            delete updatedPermissions[`${storePrefix}orders`];
            delete updatedPermissions[`${storePrefix}rma`];
            delete updatedPermissions[`${storePrefix}outbound`];
        });

        form.setFieldsValue({
            permitted_stores: values,
            store_permissions: updatedPermissions
        });
    };

    const handleAdd = () => {
        setEditingGroup(null);
        setSelectedStores([]);
        form.resetFields();
        form.setFieldsValue({
            main_permissions: {
                inventory: false,
                inventory_ram: false,
                outbound: false,
                inbound: false,
                purchase_order: false
            }
        });
        setIsModalVisible(true);
    };

    const handleEdit = (group) => {
        if (group.is_system) {
            message.warning('System groups cannot be edited');
            return;
        }
        setEditingGroup(group);
        const permittedStores = group.permitted_stores || [];
        setSelectedStores(permittedStores);

        // 轉換商店權限格式
        const storePermissions = {};
        if (group.store_permissions) {
            Object.entries(group.store_permissions).forEach(([storeId, features]) => {
                // 確保 features 是對象
                const parsedFeatures = typeof features === 'string' ? 
                    JSON.parse(features) : features;

                // 設置商店權限
                const permissions = [];
                if (parsedFeatures.inventory) permissions.push('inventory');
                if (parsedFeatures.orders) permissions.push('orders');
                if (parsedFeatures.rma) permissions.push('rma');
                if (parsedFeatures.outbound) permissions.push('outbound');

                storePermissions[storeId] = {
                    permissions: permissions,
                    bulk_select: parsedFeatures.bulk_select || false
                };
            });
        }

        // 設置表單值
        const formValues = {
            name: group.name,
            description: group.description,
            permitted_stores: permittedStores,
            store_permissions: storePermissions,
            main_permissions: Object.entries(group.main_permissions || {})
                .filter(([_, value]) => value === 1 || value === true)
                .map(([key]) => key)
        };

        console.log('Setting form values:', formValues);
        form.setFieldsValue(formValues);
        setIsModalVisible(true);
    };

    const handleSubmit = async (values) => {
        try {
            // Convert main permissions to boolean values
            const mainPermissions = (values.main_permissions || []).reduce((acc, key) => {
                acc[key] = true;
                return acc;
            }, {});

            // Process store permissions - convert to array format for API
            const storePermissionsArray = selectedStores.map(storeId => {
                const storePerms = values.store_permissions?.[storeId] || {};
                const permissions = storePerms.permissions || [];
                const bulkSelect = storePerms.bulk_select || false;
                
                return {
                    store_id: storeId,
                    inventory: permissions.includes('inventory'),
                    orders: permissions.includes('orders'),
                    rma: permissions.includes('rma'),
                    outbound: permissions.includes('outbound'),
                    bulk_select: bulkSelect
                };
            });

            const groupData = {
                name: values.name.trim(),
                description: values.description.trim(),
                main_permissions: mainPermissions,
                store_permissions: storePermissionsArray,
                permitted_stores: values.permitted_stores || []
            };

            console.log('Submitting group data:', groupData);

            if (editingGroup) {
                await userService.updateGroup(editingGroup.id, groupData);
                message.success('Group updated successfully');
            } else {
                await userService.createGroup(groupData);
                message.success('Group created successfully');
            }

            setEditingGroup(null);
            setSelectedStores([]);
            form.resetFields();
            setIsModalVisible(false);
            fetchGroups();

        } catch (error) {
            console.error('Error submitting group:', error);
            message.error(error.message || 'Failed to submit group');
        }
    };

    const handleDelete = async (group) => {
        if (group.is_system) {
            message.warning('System groups cannot be deleted');
            return;
        }

        Modal.confirm({
            title: 'Delete Group',
            content: 'Are you sure you want to delete this group? This action cannot be undone.',
            okText: 'Yes',
            okType: 'danger',
            cancelText: 'No',
            onOk: async () => {
                try {
                    setLoading(true);
                    setError(null);
                    
                    const response = await userService.deleteGroup(group.id);
                    
                    if (!response?.success) {
                        throw new Error(response?.error || 'Failed to delete group');
                    }
                    
                    message.success('Group deleted successfully');
                    await fetchGroups();
                } catch (error) {
                    console.error('Error deleting group:', error);
                    setError(error.message);
                    message.error('Failed to delete group');
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const renderStorePermissions = () => {
        return (
            <div>
                <Form.Item label="Store Permissions">
                    {selectedStores.map(storeId => {
                        const store = stores.find(s => s.id === storeId);
                        if (!store) return null;

                        return (
                            <Card 
                                key={storeId} 
                                title={store.name}
                                style={{ marginBottom: 16 }}
                            >
                                <Form.Item
                                    name={['store_permissions', storeId, 'permissions']}
                                    initialValue={[]}
                                >
                                    <Checkbox.Group style={{ width: '100%' }}>
                                        <Row>
                                            <Col span={8}>
                                                <Checkbox value="inventory">
                                                    Inventory Management
                                                </Checkbox>
                                            </Col>
                                            <Col span={8}>
                                                <Checkbox value="orders">
                                                    Orders Management
                                                </Checkbox>
                                            </Col>
                                            <Col span={8}>
                                                <Checkbox value="rma">
                                                    RMA Management
                                                </Checkbox>
                                            </Col>
                                            <Col span={8}>
                                                <Checkbox value="outbound">
                                                    Outbound Management
                                                </Checkbox>
                                            </Col>
                                        </Row>
                                    </Checkbox.Group>
                                </Form.Item>
                                <Form.Item
                                    name={['store_permissions', storeId, 'bulk_select']}
                                    valuePropName="checked"
                                    initialValue={false}
                                >
                                    <Checkbox>
                                        Enable Bulk Select
                                    </Checkbox>
                                </Form.Item>
                            </Card>
                        );
                    })}
                </Form.Item>
            </div>
        );
    };

    const renderMainPermissions = () => (
        <Form.Item label="Main Permissions" name="main_permissions">
            <Checkbox.Group>
                <Row>
                    <Col span={8}>
                        <Checkbox value="inventory">Inventory Management</Checkbox>
                    </Col>
                    <Col span={8}>
                        <Checkbox value="outbound">Outbound Management</Checkbox>
                    </Col>
                    <Col span={8}>
                        <Checkbox value="store">Store Management</Checkbox>
                    </Col>
                    <Col span={8}>
                        <Checkbox value="rma">RMA Management</Checkbox>
                    </Col>
                    <Col span={8}>
                        <Checkbox value="reports">Reports Access</Checkbox>
                    </Col>
                    <Col span={8}>
                        <Checkbox value="settings">Settings Access</Checkbox>
                    </Col>
                    <Col span={8}>
                        <Checkbox value="bulk_select">Bulk Select</Checkbox>
                    </Col>
                </Row>
            </Checkbox.Group>
        </Form.Item>
    );

    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
                <Space>
                    {text}
                    {record.is_system && (
                        <Tooltip title="System Group">
                            <LockOutlined style={{ color: '#1890ff' }} />
                        </Tooltip>
                    )}
                </Space>
            )
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description',
        },
        {
            title: 'Permitted Stores',
            dataIndex: 'permitted_stores',
            key: 'permitted_stores',
            render: (permitted_stores) => (
                <Space>
                    {(permitted_stores || []).map(storeId => {
                        const store = stores.find(s => s.id === storeId);
                        return store ? (
                            <Tag key={storeId} color="blue">
                                {store.name}
                            </Tag>
                        ) : null;
                    })}
                    {(!permitted_stores || permitted_stores.length === 0) && (
                        <Tag color="green">All Stores</Tag>
                    )}
                </Space>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Button 
                        type="link" 
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                        disabled={loading || record.is_system}
                    >
                        Edit
                    </Button>
                    <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(record)}
                        disabled={loading || record.is_system}
                    >
                        Delete
                    </Button>
                </Space>
            )
        }
    ];

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={2}>Group Management</Title>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAdd}
                    disabled={loading}
                >
                    Add Group
                </Button>
            </div>

            {error && (
                <Alert
                    message={error}
                    type="error"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            <Table 
                columns={columns} 
                dataSource={groups}
                loading={loading}
                rowKey="id"
            />

            <Modal
                title={`${editingGroup ? 'Edit' : 'Add'} Group`}
                open={isModalVisible}
                onOk={() => form.submit()}
                onCancel={() => setIsModalVisible(false)}
                confirmLoading={loading}
                width={800}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <Form.Item
                        name="name"
                        label="Group Name"
                        rules={[
                            { required: true, message: 'Please enter group name' },
                            { min: 3, message: 'Name must be at least 3 characters' }
                        ]}
                    >
                        <Input placeholder="Enter group name" />
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="Description"
                        rules={[
                            { required: true, message: 'Please enter group description' }
                        ]}
                    >
                        <TextArea 
                            placeholder="Enter group description"
                            autoSize={{ minRows: 2, maxRows: 6 }}
                        />
                    </Form.Item>

                    <Form.Item
                        name="permitted_stores"
                        label={
                            <Space>
                                Permitted Stores
                                <Tooltip title={editingGroup?.is_system ? 
                                    "System groups have access to all stores" : 
                                    "At least one store must be selected"}>
                                    <QuestionCircleOutlined />
                                </Tooltip>
                            </Space>
                        }
                        rules={[
                            {
                                required: !editingGroup?.is_system,
                                message: 'Please select at least one store'
                            },
                            {
                                validator: (_, value) => {
                                    if (!editingGroup?.is_system && (!value || value.length === 0)) {
                                        return Promise.reject('At least one store must be selected');
                                    }
                                    return Promise.resolve();
                                }
                            }
                        ]}
                    >
                        <Select
                            mode="multiple"
                            placeholder="Select stores"
                            style={{ width: '100%' }}
                            allowClear
                            disabled={editingGroup?.is_system}
                            onChange={handleStoreSelect}
                            value={selectedStores}
                        >
                            {stores.map(store => (
                                <Option key={store.id} value={store.id}>
                                    {store.name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    {renderStorePermissions()}
                    {renderMainPermissions()}
                </Form>
            </Modal>
        </div>
    );
};

export default GroupManagement; 