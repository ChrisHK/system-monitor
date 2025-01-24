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
    Checkbox
} from 'antd';
import { 
    EditOutlined, 
    PlusOutlined,
    QuestionCircleOutlined,
    DeleteOutlined 
} from '@ant-design/icons';
import { groupApi, storeApi } from '../../services/api';

const { Option } = Select;

const DEFAULT_GROUPS = [
    {
        id: 1,
        name: 'admin',
        description: 'Administrator group with full access',
        permitted_stores: [], // All stores
        main_permissions: {
            inventory: true,
            inventory_ram: true,
            outbound: true
        },
        is_system: true
    },
    {
        id: 2,
        name: 'user',
        description: 'Regular user group with limited access',
        permitted_stores: [], // Specific stores only
        main_permissions: {
            inventory: false,
            inventory_ram: false,
            outbound: false
        },
        is_system: true
    }
];

const GroupManagement = () => {
    const [groups, setGroups] = useState(DEFAULT_GROUPS);
    const [stores, setStores] = useState([]);
    const [editingGroup, setEditingGroup] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState(null);

    const fetchGroups = async () => {
        try {
            console.log('Fetching groups...');
            const response = await groupApi.getGroups();
            console.log('Groups response:', response);

            if (response?.success) {
                // Get the groups from the backend
                const backendGroups = response.groups || [];
                console.log('Backend groups:', backendGroups);
                
                // Only keep admin from DEFAULT_GROUPS
                const adminGroup = DEFAULT_GROUPS.find(g => g.name === 'admin');
                const updatedDefaultGroups = [adminGroup];
                
                // Update admin group with data from backend if it exists
                const backendAdmin = backendGroups.find(bg => bg.name === 'admin');
                if (backendAdmin) {
                    updatedDefaultGroups[0] = { ...backendAdmin, is_system: true };
                }

                // Get all other groups from backend
                const otherGroups = backendGroups.filter(group => group.name !== 'admin');
                
                // Set all groups
                const allGroups = [...updatedDefaultGroups, ...otherGroups];
                console.log('Setting all groups:', allGroups);
                setGroups(allGroups);
                return true;
            }
            console.warn('No success in response:', response);
            return false;
        } catch (error) {
            console.error('Error fetching groups:', error);
            message.error('Failed to load groups');
            // Fallback to admin group only
            setGroups([DEFAULT_GROUPS.find(g => g.name === 'admin')]);
            return false;
        }
    };

    const fetchStores = async () => {
        try {
            const response = await storeApi.getStores();
            if (response?.success) {
                setStores(response.stores);
            }
        } catch (error) {
            console.error('Error fetching stores:', error);
            message.error('Failed to load stores');
        }
    };

    useEffect(() => {
        fetchGroups();
        fetchStores();
    }, []);

    const handleAdd = () => {
        setEditingGroup(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (group) => {
        if (group.is_system) {
            message.warning('System groups cannot be edited');
            return;
        }
        setEditingGroup(group);
        
        // Set basic fields
        const formValues = {
            name: group.name,
            description: group.description,
            permitted_stores: group.permitted_stores || [],
            store_permissions: {},
            main_permissions: group.main_permissions || {
                inventory: false,
                inventory_ram: false,
                outbound: false
            }
        };

        // Set store permissions
        if (group.permitted_stores && group.store_permissions) {
            group.permitted_stores.forEach(storeId => {
                const permissions = group.store_permissions[storeId] || {};
                formValues.store_permissions[`store_${storeId}_inventory`] = permissions.inventory || false;
                formValues.store_permissions[`store_${storeId}_orders`] = permissions.orders || false;
                formValues.store_permissions[`store_${storeId}_rma`] = permissions.rma || false;
            });
        }

        form.setFieldsValue(formValues);
        setIsModalVisible(true);
    };

    const handleSubmit = async (values) => {
        try {
            const { name, description, permitted_stores, store_permissions = {}, main_permissions = {} } = values;
            
            // 重構 store_permissions 以匹配後端期望的格式
            const transformedStorePermissions = {};
            permitted_stores.forEach(storeId => {
                transformedStorePermissions[storeId] = {
                    inventory: store_permissions[`store_${storeId}_inventory`] || false,
                    orders: store_permissions[`store_${storeId}_orders`] || false,
                    rma: store_permissions[`store_${storeId}_rma`] || false
                };
            });

            const groupData = {
                name,
                description,
                store_permissions: transformedStorePermissions
            };

            let response;
            if (editingGroup) {
                response = await groupApi.updateGroup(editingGroup.id, groupData);
                
                // Update main permissions separately
                if (response?.success) {
                    const permissionsResponse = await groupApi.updateGroupPermissions(editingGroup.id, main_permissions);
                    if (!permissionsResponse?.success) {
                        throw new Error('Failed to update main permissions');
                    }
                }
            } else {
                response = await groupApi.createGroup(groupData);
                
                // Set main permissions for new group
                if (response?.success) {
                    const newGroupId = response.group.id;
                    const permissionsResponse = await groupApi.updateGroupPermissions(newGroupId, main_permissions);
                    if (!permissionsResponse?.success) {
                        throw new Error('Failed to set main permissions');
                    }
                }
            }

            if (response?.success) {
                message.success(`Group ${editingGroup ? 'updated' : 'created'} successfully`);
                setIsModalVisible(false);
                form.resetFields();
                fetchGroups();
            }
        } catch (error) {
            console.error('Error saving group:', error);
            message.error(error.response?.data?.error || `Failed to ${editingGroup ? 'update' : 'create'} group`);
        }
    };

    const handleDelete = async (group) => {
        if (group.name === 'admin') {
            message.warning('Admin group cannot be deleted');
            return;
        }
        setGroupToDelete(group);
        setDeleteConfirmVisible(true);
    };

    const confirmDelete = async () => {
        try {
            const response = await groupApi.deleteGroup(groupToDelete.id);
            if (response?.success) {
                message.success('Group deleted successfully');
                await fetchGroups();
            }
        } catch (error) {
            console.error('Error deleting group:', error);
            message.error(error.response?.data?.error || 'Failed to delete group');
        } finally {
            setDeleteConfirmVisible(false);
            setGroupToDelete(null);
        }
    };

    const columns = [
        {
            title: 'Group Name',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
                <Space>
                    {text}
                    {record.name === 'admin' && <Tag color="gold">System</Tag>}
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
            render: (permitted_stores, record) => (
                <Space direction="vertical">
                    {record.name === 'admin' ? (
                        <Tag color="blue">All Stores</Tag>
                    ) : (permitted_stores || []).map(storeId => {
                        const store = stores.find(s => s.id === storeId);
                        if (!store) return null;

                        const permissions = record.store_permissions?.[storeId] || {};
                        return (
                            <div key={storeId}>
                                <Tag color="blue">{store.name}</Tag>
                                <div style={{ marginLeft: 8, display: 'inline-block' }}>
                                    {permissions.inventory && <Tag color="green">Inventory</Tag>}
                                    {permissions.orders && <Tag color="cyan">Orders</Tag>}
                                    {permissions.rma && <Tag color="purple">RMA</Tag>}
                                </div>
                            </div>
                        );
                    })}
                </Space>
            )
        },
        {
            title: 'Main Permissions',
            key: 'main_permissions',
            render: (_, record) => (
                <Space direction="vertical">
                    {record.name === 'admin' ? (
                        <Tag color="blue">All Permissions</Tag>
                    ) : (
                        <>
                            {record.main_permissions?.inventory && <Tag color="green">Inventory</Tag>}
                            {record.main_permissions?.inventory_ram && <Tag color="cyan">Inventory RAM</Tag>}
                            {record.main_permissions?.outbound && <Tag color="orange">Outbound</Tag>}
                        </>
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
                        disabled={record.name === 'admin'}
                    >
                        Edit
                    </Button>
                    <Button 
                        type="link" 
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(record)}
                        disabled={record.name === 'admin'}
                    >
                        Delete
                    </Button>
                </Space>
            )
        }
    ];

    const renderStorePermissions = () => {
        const selectedStores = form.getFieldValue('permitted_stores') || [];
        
        if (selectedStores.length === 0) {
            return null;
        }

        return (
            <div style={{ marginTop: 16 }}>
                <Typography.Title level={5}>Store Feature Permissions</Typography.Title>
                {selectedStores.map(storeId => {
                    const store = stores.find(s => s.id === storeId);
                    if (!store) return null;

                    return (
                        <div key={storeId} style={{ marginBottom: 16 }}>
                            <Typography.Text strong>{store.name}</Typography.Text>
                            <div style={{ marginLeft: 24, marginTop: 8 }}>
                                <Form.Item
                                    name={['store_permissions', `store_${storeId}_inventory`]}
                                    valuePropName="checked"
                                    initialValue={false}
                                >
                                    <Checkbox>Inventory Management</Checkbox>
                                </Form.Item>
                                <Form.Item
                                    name={['store_permissions', `store_${storeId}_orders`]}
                                    valuePropName="checked"
                                    initialValue={false}
                                >
                                    <Checkbox>Order Management</Checkbox>
                                </Form.Item>
                                <Form.Item
                                    name={['store_permissions', `store_${storeId}_rma`]}
                                    valuePropName="checked"
                                    initialValue={false}
                                >
                                    <Checkbox>RMA Management</Checkbox>
                                </Form.Item>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderMainPermissions = () => {
        return (
            <div style={{ marginTop: 16 }}>
                <Typography.Title level={5}>Main Permissions</Typography.Title>
                <Form.Item
                    name={['main_permissions', 'inventory']}
                    valuePropName="checked"
                    initialValue={false}
                >
                    <Checkbox>Inventory Management</Checkbox>
                </Form.Item>
                <Form.Item
                    name={['main_permissions', 'inventory_ram']}
                    valuePropName="checked"
                    initialValue={false}
                >
                    <Checkbox>Inventory RAM Management</Checkbox>
                </Form.Item>
                <Form.Item
                    name={['main_permissions', 'outbound']}
                    valuePropName="checked"
                    initialValue={false}
                >
                    <Checkbox>Outbound Management</Checkbox>
                </Form.Item>
            </div>
        );
    };

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <Button 
                    type="primary" 
                    icon={<PlusOutlined />}
                    onClick={handleAdd}
                >
                    Add Group
                </Button>
            </div>

            <Table 
                columns={columns} 
                dataSource={groups}
                rowKey="id"
            />

            <Modal
                title={editingGroup ? "Edit Group" : "Add Group"}
                open={isModalVisible}
                onOk={() => form.submit()}
                onCancel={() => {
                    setIsModalVisible(false);
                    form.resetFields();
                }}
                width={600}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    onValuesChange={(changedValues) => {
                        if (changedValues.permitted_stores) {
                            // Reset store permissions when stores selection changes
                            const currentValues = form.getFieldValue('store_permissions') || {};
                            const newPermissions = {};
                            changedValues.permitted_stores.forEach(storeId => {
                                newPermissions[`store_${storeId}_inventory`] = currentValues[`store_${storeId}_inventory`] || false;
                                newPermissions[`store_${storeId}_orders`] = currentValues[`store_${storeId}_orders`] || false;
                                newPermissions[`store_${storeId}_rma`] = currentValues[`store_${storeId}_rma`] || false;
                            });
                            form.setFieldsValue({ store_permissions: newPermissions });
                        }
                    }}
                >
                    <Form.Item
                        name="name"
                        label="Group Name"
                        rules={[
                            { required: true, message: 'Please input group name!' },
                            { 
                                validator: (_, value) => {
                                    if (value === 'admin' && !editingGroup) {
                                        return Promise.reject('This group name is reserved');
                                    }
                                    return Promise.resolve();
                                }
                            }
                        ]}
                    >
                        <Input disabled={editingGroup?.name === 'admin'} />
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="Description"
                    >
                        <Input.TextArea />
                    </Form.Item>

                    <Form.Item
                        name="permitted_stores"
                        label="Permitted Stores"
                        rules={[{ required: true, message: 'Please select at least one store!' }]}
                    >
                        <Select
                            mode="multiple"
                            placeholder="Select stores"
                            disabled={editingGroup?.name === 'admin'}
                        >
                            {stores.map(store => (
                                <Option key={store.id} value={store.id}>
                                    Store {store.id} - {store.name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    {renderMainPermissions()}
                    {renderStorePermissions()}
                </Form>
            </Modal>

            <Modal
                title="Confirm Delete"
                open={deleteConfirmVisible}
                onOk={confirmDelete}
                onCancel={() => {
                    setDeleteConfirmVisible(false);
                    setGroupToDelete(null);
                }}
                okText="Yes, delete"
                cancelText="No, cancel"
                okButtonProps={{ danger: true }}
            >
                <p>Are you sure you want to delete the group "{groupToDelete?.name}"?</p>
                <p>This action cannot be undone.</p>
            </Modal>
        </div>
    );
};

export default GroupManagement; 