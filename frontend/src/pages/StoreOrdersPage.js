import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Button, message, Input, Collapse, Space, Modal, Tag, Select } from 'antd';
import { orderApi, rmaApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { ExclamationCircleOutlined } from '@ant-design/icons';

const { TextArea, Search } = Input;
const { Panel } = Collapse;
const { Option } = Select;

const StoreOrdersPage = () => {
    const { storeId } = useParams();
    const navigate = useNavigate();
    const { isAdmin } = useAuth();
    const { addNotification } = useNotification();
    const [isLoading, setIsLoading] = useState(false);
    const [orders, setOrders] = useState([]);
    const [pendingOrder, setPendingOrder] = useState(null);
    const [editingNotes, setEditingNotes] = useState({});
    const [editingPrice, setEditingPrice] = useState({});
    const [searchText, setSearchText] = useState('');
    const [rmaReasons, setRmaReasons] = useState({});
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [reasonText, setReasonText] = useState('');

    const fetchOrders = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await orderApi.getOrders(storeId);
            console.log('Orders API Response:', {
                success: response.success,
                orderCount: response.orders?.length,
                firstOrder: response.orders?.[0],
            });
            
            // Group orders by order_id
            const groupedOrders = response.orders.reduce((acc, item) => {
                // Skip items with null record_id
                if (!item.record_id) {
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
                const processedItem = {
                    id: item.id,
                    recordId: item.record_id,
                    serialNumber: item.serialnumber,
                    computerName: item.computername,
                    model: item.model,
                    notes: item.notes,
                    system_sku: item.system_sku,
                    operating_system: item.operating_system,
                    cpu: item.cpu,
                    ram_gb: item.ram,
                    disks: item.disks,
                    price: item.price,
                    pay_method: item.pay_method
                };
                acc[item.order_id].items.push(processedItem);
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
        
        // Check if all items have prices
        const hasEmptyPrices = pendingOrder.items.some(item => !item.price);
        if (hasEmptyPrices) {
            message.error('Please enter prices for all items before saving the order');
            return;
        }
        
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

    const handleSavePayMethod = async (itemId, payMethod) => {
        try {
            const response = await orderApi.updateOrderItemPayMethod(storeId, itemId, payMethod);
            if (response?.success) {
                message.success('Payment method saved successfully');
                fetchOrders();
            } else {
                throw new Error(response?.error || 'Failed to save payment method');
            }
        } catch (error) {
            message.error(error.message || 'Failed to save payment method');
            console.error('Error in handleSavePayMethod:', error);
        }
    };

    const handleSearch = (value) => {
        setSearchText(value.toLowerCase());
    };

    const handleRmaClick = (item) => {
        if (rmaReasons[item.recordId]) {
            // If reason exists, proceed with return
            handleReturn(item);
        } else {
            // Show reason input modal
            setSelectedItem(item);
            setReasonText('');
            setShowReasonModal(true);
        }
    };

    const handleReasonSubmit = () => {
        if (!reasonText.trim()) {
            message.error('Please enter a reason');
            return;
        }

        setRmaReasons(prev => ({
            ...prev,
            [selectedItem.recordId]: reasonText.trim()
        }));
        setShowReasonModal(false);
        message.success('Reason saved successfully');
    };

    const handleReturn = async (item) => {
        console.log('Return item:', item);
        if (!item.recordId) {
            message.error('Invalid record ID');
            return;
        }
        
        const reason = rmaReasons[item.recordId];
        if (!reason) {
            message.error('Please enter reason for return');
            return;
        }

        try {
            const rmaData = {
                recordId: item.recordId,
                reason: reason,
                notes: item.notes || ''
            };
            console.log('RMA data to be sent:', rmaData);
            
            const response = await rmaApi.addToRma(storeId, rmaData);
            console.log('RMA API response:', response);

            if (response && response.success) {
                // Add notification for RMA
                console.log('Adding RMA notification for store:', storeId);
                addNotification('rma', storeId);
                
                message.success('Item added to RMA successfully');
                // Clear the reason after successful RMA
                setRmaReasons(prev => {
                    const newReasons = { ...prev };
                    delete newReasons[item.recordId];
                    return newReasons;
                });
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
            dataIndex: 'ram_gb',
            key: 'ram_gb',
            render: (text) => text || '-'
        },
        {
            title: 'Disks',
            dataIndex: 'disks',
            key: 'disks'
        },
        {
            title: 'Pay Method',
            dataIndex: 'pay_method',
            key: 'pay_method',
            render: (text, record) => (
                <Select
                    defaultValue={text || 'Credit Card'}
                    style={{ width: 120 }}
                    onChange={(value) => handleSavePayMethod(record.id, value)}
                    disabled={record.order?.status === 'completed'}
                >
                    <Option value="Credit Card">Credit Card</Option>
                    <Option value="Bank Transfer">Bank Transfer</Option>
                    <Option value="Cash">Cash</Option>
                    <Option value="Other">Other</Option>
                </Select>
            )
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
                                    message.error('Price is required');
                                    return;
                                }
                                handleSavePrice(record.id, value);
                            }}
                            onPressEnter={e => {
                                e.preventDefault();
                                const value = e.target.value;
                                if (!value || isNaN(value) || value <= 0) {
                                    message.error('Price is required');
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
        if (col.key === 'ram_gb') {
            return col;
        }
        if (col.key === 'pay_method') {
            return {
                ...col,
                render: (text) => text || 'Credit Card'
            };
        }
        return col;
    });

    // Add Return and Delete actions to completed columns
    completedColumns.push({
        title: 'Actions',
        key: 'actions',
        render: (_, record) => {
            const hasReason = rmaReasons[record.recordId];
            
            return (
                <Space>
                    {hasReason && (
                        <Tag color="success">Ready</Tag>
                    )}
                    <Button 
                        type={hasReason ? "primary" : "default"}
                        onClick={() => handleRmaClick(record)}
                        title={hasReason ? "Ready to RMA, click 'Return' again to send to RMA" : "Click to enter RMA reason"}
                    >
                        {hasReason ? 'Return' : 'RMA'}
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
            );
        }
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
                                summary={pageData => {
                                    const total = pageData.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
                                    return (
                                        <Table.Summary fixed="bottom">
                                            <Table.Summary.Row>
                                                <Table.Summary.Cell index={0} colSpan={completedColumns.length - 1}></Table.Summary.Cell>
                                                <Table.Summary.Cell index={1}>
                                                    <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                        Total: ${total.toFixed(2)}
                                                    </div>
                                                </Table.Summary.Cell>
                                            </Table.Summary.Row>
                                        </Table.Summary>
                                    );
                                }}
                            />
                        )
                    }))}
                />
            </Card>

            {/* Add Reason Modal */}
            <Modal
                title="Enter RMA Reason"
                open={showReasonModal}
                onOk={handleReasonSubmit}
                onCancel={() => setShowReasonModal(false)}
                okText="OK"
                cancelText="Cancel"
            >
                <Input.TextArea
                    placeholder="Please enter reason for return"
                    value={reasonText}
                    onChange={e => setReasonText(e.target.value)}
                    rows={4}
                    style={{ marginTop: '16px' }}
                />
            </Modal>
        </div>
    );
};

export default StoreOrdersPage;