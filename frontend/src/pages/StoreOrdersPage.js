import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Button, message, Input, Collapse, Space, Modal } from 'antd';
import { orderApi, rmaApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ExclamationCircleOutlined } from '@ant-design/icons';

const { TextArea, Search } = Input;
const { Panel } = Collapse;

const StoreOrdersPage = () => {
    const { storeId } = useParams();
    const navigate = useNavigate();
    const { isAdmin } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [orders, setOrders] = useState([]);
    const [pendingOrder, setPendingOrder] = useState(null);
    const [editingNotes, setEditingNotes] = useState({});
    const [editingPrice, setEditingPrice] = useState({});
    const [searchText, setSearchText] = useState('');

    const fetchOrders = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await orderApi.getOrders(storeId);
            console.log('Orders response:', response);
            
            // Group orders by order_id
            const groupedOrders = response.orders.reduce((acc, item) => {
                console.log('Processing item:', item);
                // Skip items with null record_id
                if (!item.record_id) {
                    console.log('Skipping item due to null record_id:', item);
                    return acc;
                }

                if (!acc[item.order_id]) {
                    acc[item.order_id] = {
                        id: item.order_id,
                        status: item.status,
                        created_at: item.created_at,
                        items: []
                    };
                }
                acc[item.order_id].items.push({
                    id: item.id,
                    recordId: item.record_id,
                    serialNumber: item.serialnumber,
                    computerName: item.computername,
                    model: item.model,
                    notes: item.notes,
                    system_sku: item.system_sku,
                    operating_system: item.operating_system,
                    cpu: item.cpu,
                    ram: item.ram_gb,
                    disks: item.disks,
                    price: item.price
                });
                return acc;
            }, {});

            console.log('Grouped orders:', groupedOrders);
            const ordersList = Object.values(groupedOrders);
            const pending = ordersList.find(order => order.status === 'pending');
            setPendingOrder(pending || null);
            setOrders(ordersList.filter(order => order.status === 'completed'));
        } catch (error) {
            message.error('Failed to fetch orders');
            console.error('Error in fetchOrders:', error);
        } finally {
            setIsLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const handleSaveOrder = async () => {
        if (!pendingOrder) return;
        
        try {
            await orderApi.saveOrder(storeId, pendingOrder.id);
            message.success('Order saved successfully');
            fetchOrders();
        } catch (error) {
            message.error('Failed to save order');
            console.error(error);
        }
    };

    const handleDeleteItem = async (itemId) => {
        if (!itemId) {
            message.error('Invalid item ID');
            return;
        }

        try {
            await orderApi.deleteOrderItem(storeId, itemId);
            message.success('Item deleted successfully');
            fetchOrders();
        } catch (error) {
            message.error('Failed to delete item');
            console.error(error);
        }
    };

    const handleSaveNotes = async (itemId, notes) => {
        try {
            await orderApi.updateOrderItemNotes(storeId, itemId, notes);
            message.success('Notes saved successfully');
            setEditingNotes(prev => ({
                ...prev,
                [itemId]: false
            }));
            fetchOrders();
        } catch (error) {
            message.error('Failed to save notes');
            console.error(error);
        }
    };

    const handleSavePrice = async (itemId, price) => {
        if (!price || isNaN(price) || price <= 0) {
            message.error('Please enter a valid price');
            return;
        }

        try {
            const response = await orderApi.updateOrderItemPrice(storeId, itemId, parseFloat(price));
            if (response?.success) {
                message.success('Price saved successfully');
                setEditingPrice(prev => ({
                    ...prev,
                    [itemId]: false
                }));
                fetchOrders();
            } else {
                throw new Error(response?.error || 'Failed to save price');
            }
        } catch (error) {
            message.error(error.message || 'Failed to save price');
            console.error('Error in handleSavePrice:', error);
        }
    };

    const handleSearch = (value) => {
        setSearchText(value.toLowerCase());
    };

    const handleReturn = async (item) => {
        console.log('Return item:', item);
        if (!item.recordId) {
            message.error('Invalid record ID');
            return;
        }
        
        try {
            // Create RMA record first
            const rmaData = {
                recordId: item.recordId,
                reason: 'Return from completed order',
                notes: item.notes || ''
            };
            console.log('RMA data to be sent:', rmaData);
            
            const response = await rmaApi.addToRma(storeId, rmaData);
            console.log('RMA API response:', response);

            if (response && response.success) {
                message.success('Item added to RMA successfully');
                // Navigate to RMA page
                navigate(`/stores/${storeId}/rma`);
            } else {
                throw new Error(response?.error || 'Failed to add item to RMA');
            }
        } catch (error) {
            console.error('Error in handleReturn:', error);
            message.error(error.message || 'Failed to process return');
        }
    };

    const handleDeleteOrder = async (storeId, orderId) => {
        try {
            const response = await fetch(`${process.env.REACT_APP_API_URL}/orders/${storeId}/${orderId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
            });

            const data = await response.json();
            
            if (response.ok) {
                message.success('Order deleted successfully');
                // Refresh the orders list
                fetchOrders();
            } else {
                message.error(data.message || 'Failed to delete order');
            }
        } catch (error) {
            console.error('Error deleting order:', error);
            message.error('Failed to delete order');
        }
    };

    const showDeleteConfirm = (storeId, orderId) => {
        Modal.confirm({
            title: 'Are you sure you want to delete this order?',
            icon: <ExclamationCircleOutlined />,
            content: 'This action cannot be undone.',
            okText: 'Yes',
            okType: 'danger',
            cancelText: 'No',
            onOk() {
                handleDeleteOrder(storeId, orderId);
            },
        });
    };

    const filterOrders = (orders) => {
        if (!searchText) return orders;

        return orders.map(order => ({
            ...order,
            items: order.items.filter(item => 
                item.serialNumber?.toLowerCase().includes(searchText) ||
                item.notes?.toLowerCase().includes(searchText)
            )
        })).filter(order => order.items.length > 0);
    };

    const columns = [
        {
            title: 'Serial Number',
            dataIndex: 'serialNumber',
            key: 'serialNumber'
        },
        {
            title: 'Computer Name',
            dataIndex: 'computerName',
            key: 'computerName'
        },
        {
            title: 'Model',
            dataIndex: 'model',
            key: 'model'
        },
        {
            title: 'System SKU',
            dataIndex: 'system_sku',
            key: 'system_sku'
        },
        {
            title: 'Operating System',
            dataIndex: 'operating_system',
            key: 'operating_system'
        },
        {
            title: 'CPU',
            dataIndex: 'cpu',
            key: 'cpu'
        },
        {
            title: 'RAM (GB)',
            dataIndex: 'ram',
            key: 'ram'
        },
        {
            title: 'Disks',
            dataIndex: 'disks',
            key: 'disks'
        },
        {
            title: 'Price',
            dataIndex: 'price',
            key: 'price',
            render: (text, record) => {
                const isEditing = editingPrice[record.id];
                return isEditing ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            defaultValue={text}
                            placeholder="Enter price"
                            onBlur={e => {
                                const value = e.target.value;
                                if (!value || isNaN(value) || value <= 0) {
                                    message.error('Please enter a valid price');
                                    return;
                                }
                                handleSavePrice(record.id, value);
                            }}
                            onPressEnter={e => {
                                e.preventDefault();
                                const value = e.target.value;
                                if (!value || isNaN(value) || value <= 0) {
                                    message.error('Please enter a valid price');
                                    return;
                                }
                                handleSavePrice(record.id, value);
                            }}
                        />
                    </div>
                ) : (
                    <div
                        style={{ cursor: 'pointer' }}
                        onClick={() => setEditingPrice(prev => ({
                            ...prev,
                            [record.id]: true
                        }))}
                    >
                        {text ? `$${text}` : (
                            <span style={{ color: '#ff4d4f' }}>
                                * Required: Click to add price
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Notes',
            dataIndex: 'notes',
            key: 'notes',
            render: (text, record) => {
                const isEditing = editingNotes[record.id];
                return isEditing ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <TextArea
                            defaultValue={text}
                            autoSize
                            onBlur={e => handleSaveNotes(record.id, e.target.value)}
                            onPressEnter={e => {
                                e.preventDefault();
                                e.target.blur();
                            }}
                        />
                    </div>
                ) : (
                    <div
                        style={{ cursor: 'pointer' }}
                        onClick={() => setEditingNotes(prev => ({
                            ...prev,
                            [record.id]: true
                        }))}
                    >
                        {text || 'Click to add notes'}
                    </div>
                );
            }
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Button 
                        type="link" 
                        danger 
                        onClick={() => handleDeleteItem(record.id)}
                    >
                        Delete
                    </Button>
                </Space>
            )
        }
    ];

    const completedColumns = columns.filter(col => col.key !== 'actions').map(col => {
        if (col.key === 'notes' || col.key === 'price') {
            return {
                ...col,
                render: (text) => col.key === 'price' ? (text ? `$${text}` : '-') : (text || '-')
            };
        }
        return col;
    });

    // Add Return and Delete actions to completed columns
    completedColumns.push({
        title: 'Actions',
        key: 'actions',
        render: (_, record) => (
            <Space>
                <Button 
                    type="primary"
                    onClick={() => handleReturn(record)}
                >
                    Return
                </Button>
                {isAdmin() && (
                    <Button 
                        type="link" 
                        danger
                        onClick={() => showDeleteConfirm(storeId, record.order.id)}
                    >
                        Delete
                    </Button>
                )}
            </Space>
        )
    });

    return (
        <div style={{ padding: '24px' }}>
            {pendingOrder && pendingOrder.items.length > 0 && (
                <Card 
                    title="Pending Order" 
                    extra={
                        <Button 
                            type="primary" 
                            onClick={handleSaveOrder}
                            disabled={!pendingOrder.items.length}
                        >
                            Save Order
                        </Button>
                    }
                    style={{ marginBottom: '24px' }}
                >
                    <Table
                        dataSource={pendingOrder.items}
                        columns={columns}
                        rowKey={record => `pending-${record.recordId || record.id || Date.now()}`}
                        pagination={false}
                    />
                </Card>
            )}

            <Card title="Completed Orders">
                <div style={{ marginBottom: 16 }}>
                    <Search
                        placeholder="Search by Serial Number or Notes"
                        allowClear
                        onSearch={handleSearch}
                        onChange={e => handleSearch(e.target.value)}
                        style={{ width: 300 }}
                    />
                </div>
                <Collapse
                    items={filterOrders(orders).map(order => ({
                        key: order.id,
                        label: `Order #${order.id} - ${new Date(order.created_at).toLocaleString()}`,
                        children: (
                            <Table
                                dataSource={order.items.map(item => ({ ...item, order }))}
                                columns={completedColumns}
                                rowKey={record => `completed-${order.id}-${record.recordId || record.id || Date.now()}`}
                                pagination={false}
                                locale={{ emptyText: 'No items in this order' }}
                            />
                        )
                    }))}
                />
            </Card>
        </div>
    );
};

export default StoreOrdersPage;