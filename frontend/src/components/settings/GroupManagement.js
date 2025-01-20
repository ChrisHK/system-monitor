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
    Tooltip 
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
        features: ['import', 'export', 'settings'],
        access_rights: ['read', 'write', 'delete'],
        is_system: true
    },
    {
        id: 2,
        name: 'user',
        description: 'Regular user group with limited access',
        permitted_stores: [], // Specific stores only
        features: [],
        access_rights: ['read'],
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
                
                // Update system groups with data from backend if they exist
                const updatedDefaultGroups = DEFAULT_GROUPS.map(defaultGroup => {
                    const backendGroup = backendGroups.find(bg => bg.name === defaultGroup.name);
                    return backendGroup ? { ...backendGroup, is_system: true } : defaultGroup;
                });
                console.log('Updated default groups:', updatedDefaultGroups);

                // Get custom groups (non-system groups)
                const customGroups = backendGroups.filter(
                    group => !DEFAULT_GROUPS.some(dg => dg.name === group.name)
                );
                console.log('Custom groups:', customGroups);

                // Set all groups
                const allGroups = [...updatedDefaultGroups, ...customGroups];
                console.log('Setting all groups:', allGroups);
                setGroups(allGroups);
                return true;
            }
            console.warn('No success in response:', response);
            return false;
        } catch (error) {
            console.error('Error fetching groups:', error);
            message.error('Failed to load groups');
            // Fallback to default groups
            setGroups(DEFAULT_GROUPS);
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
        form.setFieldsValue({
            name: group.name,
            description: group.description,
            permitted_stores: group.permitted_stores || []
        });
        setIsModalVisible(true);
    };

    const handleSubmit = async (values) => {
        if (isSubmitting) return;
        
        try {
            setIsSubmitting(true);
            let response;
            if (editingGroup) {
                response = await groupApi.updateGroup(editingGroup.id, values);
            } else {
                response = await groupApi.createGroup(values);
            }

            if (response?.success) {
                // First fetch the updated groups
                await fetchGroups();
                // Then close the modal and show success message
                message.success(`Group ${editingGroup ? 'updated' : 'created'} successfully`);
                form.resetFields();
                setIsModalVisible(false);
            }
        } catch (error) {
            console.error('Error saving group:', error);
            // Show the specific error message from the backend
            const errorMessage = error.response?.data?.error || `Failed to ${editingGroup ? 'update' : 'create'} group`;
            message.error(errorMessage);
            
            // If it's a name conflict, highlight the name field
            if (errorMessage.includes('already exists')) {
                form.setFields([
                    {
                        name: 'name',
                        errors: ['This group name is already taken. Please choose a different name.']
                    }
                ]);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (group) => {
        if (group.is_system) {
            message.warning('System groups cannot be deleted');
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
                    {record.is_system && <Tag color="gold">System</Tag>}
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
                <Space>
                    {record.is_system && record.name === 'admin' ? (
                        <Tag color="blue">All Stores</Tag>
                    ) : (permitted_stores || []).map(storeId => {
                        const store = stores.find(s => s.id === storeId);
                        return store ? (
                            <Tag key={storeId} color="blue">
                                {store.name}
                            </Tag>
                        ) : null;
                    })}
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
                        disabled={record.is_system}
                    >
                        Edit
                    </Button>
                    <Button 
                        type="link" 
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(record)}
                        disabled={record.is_system}
                    >
                        Delete
                    </Button>
                </Space>
            )
        }
    ];

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
                confirmLoading={isSubmitting}
                okButtonProps={{ disabled: isSubmitting }}
                cancelButtonProps={{ disabled: isSubmitting }}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                >
                    <Form.Item
                        name="name"
                        label={
                            <span>
                                Group Name&nbsp;
                                <Tooltip title="Only letters, numbers, underscores and hyphens are allowed">
                                    <QuestionCircleOutlined />
                                </Tooltip>
                            </span>
                        }
                        rules={[
                            { required: true, message: 'Please input group name!' },
                            { min: 2, max: 50, message: 'Group name must be between 2 and 50 characters' },
                            {
                                pattern: /^[a-zA-Z0-9_-]+$/,
                                message: 'Group name can only contain letters, numbers, underscores and hyphens'
                            },
                            { 
                                validator: (_, value) => {
                                    if (DEFAULT_GROUPS.some(g => g.name === value)) {
                                        return Promise.reject('This group name is reserved');
                                    }
                                    return Promise.resolve();
                                }
                            }
                        ]}
                    >
                        <Input placeholder="e.g. sales-team_01" />
                    </Form.Item>

                    <Form.Item
                        name="description"
                        label="Description"
                        rules={[
                            { max: 500, message: 'Description cannot exceed 500 characters' }
                        ]}
                    >
                        <Input.TextArea rows={4} placeholder="Enter group description" />
                    </Form.Item>

                    <Form.Item
                        name="permitted_stores"
                        label="Permitted Stores"
                        rules={[{ required: true, message: 'Please select at least one store!' }]}
                    >
                        <Select
                            mode="multiple"
                            placeholder="Select stores"
                            style={{ width: '100%' }}
                        >
                            {stores.map(store => (
                                <Option key={store.id} value={store.id}>
                                    {store.name}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="features"
                        label="Features"
                        rules={[{ required: false }]}
                    >
                        <Select
                            mode="multiple"
                            placeholder="Select additional features"
                            style={{ width: '100%' }}
                        >
                            <Option value="import">Import</Option>
                            <Option value="export">Export</Option>
                            <Option value="settings">Settings</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="access_rights"
                        label="Access Rights"
                        rules={[{ required: true, message: 'Please select access rights!' }]}
                    >
                        <Select
                            mode="multiple"
                            placeholder="Select access rights"
                            style={{ width: '100%' }}
                        >
                            <Option value="read">Read</Option>
                            <Option value="write">Write</Option>
                            <Option value="delete">Delete</Option>
                        </Select>
                    </Form.Item>
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