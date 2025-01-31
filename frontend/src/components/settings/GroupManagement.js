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
    Divider
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
            inbound: true
        },
        is_system: true
    }
];

const GroupManagement = () => {
    const [groups, setGroups] = useState([]);
    const [stores, setStores] = useState([]);
    const [editingGroup, setEditingGroup] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [form] = Form.useForm();
    const [selectedStores, setSelectedStores] = useState([]);

    const fetchGroups = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await userService.getGroups();
            
            if (!response?.success) {
                throw new Error(response?.error || 'Failed to load groups');
            }
            
            // Merge with default admin group if not present
            const backendGroups = response.groups || [];
            const adminGroup = backendGroups.find(g => g.name === 'admin');
            const updatedGroups = adminGroup 
                ? backendGroups 
                : [...DEFAULT_GROUPS, ...backendGroups];
            
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
            
            setStores(response.stores);
        } catch (error) {
            console.error('Error fetching stores:', error);
            setError(error.message);
            message.error('Failed to load stores');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGroups();
        fetchStores();
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
                inbound: false
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
        setSelectedStores(group.permitted_stores || []);

        // 轉換現有的商店權限格式
        const storePermissions = {};
        if (group.store_permissions) {
            Object.entries(group.store_permissions).forEach(([storeId, features]) => {
                const storePrefix = `store_${storeId}_`;
                
                // 檢查 features 是否為字符串，如果是則解析它
                const parsedFeatures = typeof features === 'string' ? JSON.parse(features) : features;

                // 檢查每個權限值並設置默認值
                const inventory = parsedFeatures?.inventory ?? false;
                const orders = parsedFeatures?.orders ?? false;
                const rma = parsedFeatures?.rma ?? false;
                const outbound = parsedFeatures?.outbound ?? false;

                storePermissions[`${storePrefix}inventory`] = inventory;
                storePermissions[`${storePrefix}orders`] = orders;
                storePermissions[`${storePrefix}rma`] = rma;
                storePermissions[`${storePrefix}outbound`] = outbound;
            });
        }

        // 設置表單值
        const formValues = {
            name: group.name,
            description: group.description,
            permitted_stores: group.permitted_stores || [],
            store_permissions: storePermissions,
            main_permissions: {
                inventory: group.main_permissions?.inventory ?? false,
                inventory_ram: group.main_permissions?.inventory_ram ?? false,
                outbound: group.main_permissions?.outbound ?? false,
                inbound: group.main_permissions?.inbound ?? false
            }
        };

        form.setFieldsValue(formValues);
        setIsModalVisible(true);
    };

    const handleSubmit = async (values) => {
        try {
            setLoading(true);
            setError(null);

            // 1. Update basic group info
            const groupData = {
                name: values.name,
                description: values.description
            };

            const updateResponse = await userService.updateGroup(editingGroup.id, groupData);
            if (!updateResponse?.success) {
                throw new Error(updateResponse?.error || 'Failed to update group');
            }

            // 2. Process and update permissions
            const storePermissions = values.store_permissions || {};

            // 確保只處理被選中的商店
            const validStorePermissions = [];
            (values.permitted_stores || []).forEach(storeId => {
                const storePrefix = `store_${storeId}_`;
                const currentPermissions = {
                    inventory: storePermissions[`${storePrefix}inventory`] === true,
                    orders: storePermissions[`${storePrefix}orders`] === true,
                    rma: storePermissions[`${storePrefix}rma`] === true,
                    outbound: storePermissions[`${storePrefix}outbound`] === true
                };

                validStorePermissions.push({
                    store_id: String(storeId),
                    inventory: currentPermissions.inventory ? '1' : '0',
                    orders: currentPermissions.orders ? '1' : '0',
                    rma: currentPermissions.rma ? '1' : '0',
                    outbound: currentPermissions.outbound ? '1' : '0'
                });
            });

            const permissionsData = {
                main_permissions: values.main_permissions,
                permitted_stores: values.permitted_stores || [],
                store_permissions: validStorePermissions
            };
            
            const permissionsResponse = await userService.updateGroupPermissions(editingGroup.id, permissionsData);
            
            if (!permissionsResponse?.success) {
                throw new Error(permissionsResponse?.error || 'Failed to update permissions');
            }

            // 3. Convert the response data to match our local state format
            const convertedStorePermissions = {};
            Object.entries(permissionsResponse.store_permissions || {}).forEach(([storeId, permissions]) => {
                const storePrefix = `store_${storeId}_`;
                convertedStorePermissions[`${storePrefix}inventory`] = permissions.inventory === true;
                convertedStorePermissions[`${storePrefix}orders`] = permissions.orders === true;
                convertedStorePermissions[`${storePrefix}rma`] = permissions.rma === true;
                convertedStorePermissions[`${storePrefix}outbound`] = permissions.outbound === true;
            });

            // 4. Update local state
            setGroups(prevGroups => {
                return prevGroups.map(group => {
                    if (group.id === editingGroup.id) {
                        return {
                            ...group,
                            ...groupData,
                            main_permissions: permissionsResponse.main_permissions,
                            permitted_stores: permissionsResponse.permitted_stores,
                            store_permissions: permissionsResponse.store_permissions
                        };
                    }
                    return group;
                });
            });

            // 5. Update form values to match the response
            form.setFieldsValue({
                ...groupData,
                main_permissions: permissionsResponse.main_permissions,
                permitted_stores: permissionsResponse.permitted_stores,
                store_permissions: convertedStorePermissions
            });

            // 6. Update selected stores
            setSelectedStores(permissionsResponse.permitted_stores);

            message.success('Group updated successfully');
            setIsModalVisible(false);
            await fetchGroups(); // Refresh the groups list
        } catch (error) {
            console.error('Error updating group:', error);
            setError(error.message);
            message.error('Failed to update group');
        } finally {
            setLoading(false);
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
        // 使用 selectedStores 而不是從表單獲取值
        if (selectedStores.length === 0) {
            return null;
        }

        return (
            <>
                <Divider orientation="left">Store Permissions</Divider>
                {selectedStores.map(storeId => {
                    const store = stores.find(s => s.id === storeId);
                    if (!store) return null;

                    const storePrefix = `store_${storeId}_`;

                    return (
                        <Card 
                            key={storeId} 
                            size="small" 
                            title={store.name}
                            style={{ marginBottom: 16 }}
                        >
                            <Form.Item
                                name={['store_permissions', `${storePrefix}inventory`]}
                                valuePropName="checked"
                                initialValue={false}
                            >
                                <Checkbox>Inventory Management</Checkbox>
                            </Form.Item>
                            <Form.Item
                                name={['store_permissions', `${storePrefix}orders`]}
                                valuePropName="checked"
                                initialValue={false}
                            >
                                <Checkbox>Orders Management</Checkbox>
                            </Form.Item>
                            <Form.Item
                                name={['store_permissions', `${storePrefix}rma`]}
                                valuePropName="checked"
                                initialValue={false}
                            >
                                <Checkbox>RMA Management</Checkbox>
                            </Form.Item>
                            <Form.Item
                                name={['store_permissions', `${storePrefix}outbound`]}
                                valuePropName="checked"
                                initialValue={false}
                            >
                                <Checkbox>Outbound Management</Checkbox>
                            </Form.Item>
                        </Card>
                    );
                })}
            </>
        );
    };

    const renderMainPermissions = () => (
        <>
            <Divider orientation="left">Main Permissions</Divider>
            <Form.Item
                name={['main_permissions', 'inventory']}
                valuePropName="checked"
            >
                <Checkbox>Inventory Access</Checkbox>
            </Form.Item>
            <Form.Item
                name={['main_permissions', 'inventory_ram']}
                valuePropName="checked"
            >
                <Checkbox>RAM Inventory Access</Checkbox>
            </Form.Item>
            <Form.Item
                name={['main_permissions', 'outbound']}
                valuePropName="checked"
            >
                <Checkbox>Outbound Access</Checkbox>
            </Form.Item>
            <Form.Item
                name={['main_permissions', 'inbound']}
                valuePropName="checked"
            >
                <Checkbox>Inbound Access</Checkbox>
            </Form.Item>
        </>
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