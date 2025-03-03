import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Button, message, Input, Collapse, Space, Modal, Tag, Select, DatePicker } from 'antd';
import { orderService } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { ExclamationCircleOutlined, PrinterOutlined } from '@ant-design/icons';
import PrintOrder from '../components/PrintOrder';

const { TextArea, Search } = Input;
const { Panel } = Collapse;
const { Option } = Select;
const { RangePicker } = DatePicker;

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
    const [dateRange, setDateRange] = useState(null);
    const [rmaReasons, setRmaReasons] = useState({});
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [reasonText, setReasonText] = useState('');
    const [isPrintModalVisible, setIsPrintModalVisible] = useState(false);
    const [selectedOrderForPrint, setSelectedOrderForPrint] = useState(null);

    const formatPayMethod = (method) => {
        if (method === null) return '-';
        switch (method) {
            case 'credit_card':
                return 'Credit Card';
            case 'cash':
                return 'Cash';
            case 'debit_card':
                return 'Debit Card';
            default:
                return method;
        }
    };

    const paymentMethods = [
        { value: '-', label: '-' },
        { value: 'credit_card', label: 'Credit Card' },
        { value: 'cash', label: 'Cash' },
        { value: 'debit_card', label: 'Debit Card' }
    ];

    const fetchOrders = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await orderService.getStoreOrders(storeId);
            console.log('Orders API Response:', {
                success: response.success,
                orderCount: response.orders?.length,
                firstOrder: response.orders?.[0],
            });
            
            if (!response.orders) {
                return;
            }

            // Process orders directly since they're already grouped
            const ordersList = response.orders.map(order => ({
                id: order.order_id,
                status: order.status,
                created_at: order.created_at,
                items: order.items.map(item => ({
                    id: item.id,
                    recordId: item.record_id,
                    serialNumber: item.serialnumber,
                    computerName: item.computername,
                    model: item.model,
                    notes: item.notes,
                    system_sku: item.system_sku,
                    operating_system: item.operating_system,
                    cpu: item.cpu,
                    ram_gb: item.ram_gb,
                    disks: item.disks,
                    price: item.price,
                    pay_method: item.pay_method,
                    is_deleted: item.is_deleted,
                    order: item.order
                }))
            }));

            console.log('Processed orders:', ordersList);
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
        
        // Check for empty payment methods and prices
        const hasEmptyPayMethods = pendingOrder.items.some(item => !item.pay_method);
        const hasEmptyPrices = pendingOrder.items.some(item => !item.price);
        
        // If both are empty, show combined confirmation
        if (hasEmptyPayMethods && hasEmptyPrices) {
            Modal.confirm({
                title: 'Missing Information',
                content: 'Some items do not have payment methods and prices set. Do you want to continue saving the order?',
                okText: 'Yes, Save Order',
                cancelText: 'Cancel',
                onOk: async () => {
                    try {
                        await orderService.saveOrder(storeId, pendingOrder.id);
                        message.success('Order saved successfully');
                        fetchOrders();
                    } catch (error) {
                        message.error('Failed to save order');
                        console.error(error);
                    }
                }
            });
            return;
        }
        
        // If only payment methods are empty
        if (hasEmptyPayMethods) {
            Modal.confirm({
                title: 'Missing Payment Methods',
                content: 'Some items do not have payment methods set. Do you want to continue saving the order?',
                okText: 'Yes, Save Order',
                cancelText: 'Cancel',
                onOk: async () => {
                    try {
                        await orderService.saveOrder(storeId, pendingOrder.id);
                        message.success('Order saved successfully');
                        fetchOrders();
                    } catch (error) {
                        message.error('Failed to save order');
                        console.error(error);
                    }
                }
            });
            return;
        }
        
        // If only prices are empty
        if (hasEmptyPrices) {
            Modal.confirm({
                title: 'Items Without Prices',
                content: 'Some items do not have prices set. Do you want to continue saving the order?',
                okText: 'Yes, Save Order',
                cancelText: 'Cancel',
                onOk: async () => {
                    try {
                        await orderService.saveOrder(storeId, pendingOrder.id);
                        message.success('Order saved successfully');
                        fetchOrders();
                    } catch (error) {
                        message.error('Failed to save order');
                        console.error(error);
                    }
                }
            });
            return;
        }
        
        // If all information is complete
        try {
            await orderService.saveOrder(storeId, pendingOrder.id);
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
            await orderService.deleteOrderItem(storeId, itemId);
            message.success('Item deleted successfully');
            fetchOrders();
        } catch (error) {
            message.error('Failed to delete item');
            console.error(error);
        }
    };

    const handleSaveNotes = async (itemId, notes) => {
        try {
            await orderService.updateOrderItemNotes(storeId, itemId, notes);
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
            const response = await orderService.updateOrderItemPrice(storeId, itemId, parseFloat(price));
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
            // 如果選擇了 "-"，則設置為 null
            const actualPayMethod = payMethod === '-' ? null : payMethod;
            
            console.log('Updating payment method:', { itemId, payMethod: actualPayMethod });
            const response = await orderService.updateOrderItemPayMethod(storeId, itemId, actualPayMethod);
            
            if (response?.success) {
                message.success('Payment method saved successfully');
                await fetchOrders(); // 重新獲取訂單以更新顯示
            } else {
                throw new Error(response?.error || 'Failed to save payment method');
            }
        } catch (error) {
            console.error('Error in handleSavePayMethod:', error);
            message.error(error.message || 'Failed to save payment method');
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
            
            const response = await orderService.addToRma(storeId, rmaData);
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
            const response = await orderService.deleteOrder(storeId, orderId);
            if (response.success) {
                message.success('Order deleted successfully');
                fetchOrders();
            }
        } catch (error) {
            console.error('Error deleting order:', error);
            message.error('Failed to delete order');
        }
    };

    const showDeleteConfirm = (storeId, orderId, itemId = null) => {
        Modal.confirm({
            title: itemId ? 'Are you sure you want to delete this item?' : 'Are you sure you want to delete this order?',
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

    const filterOrders = useCallback((order) => {
        // First check date range if it exists
        if (dateRange && dateRange[0] && dateRange[1]) {
            const orderDate = new Date(order.created_at);
            const startDate = dateRange[0].startOf('day').toDate();
            const endDate = dateRange[1].endOf('day').toDate();
            
            if (orderDate < startDate || orderDate > endDate) {
                return false;
            }
        }

        // Then check search text if it exists
        if (!searchText) return true;

        // Search in all items, including deleted ones
        return order.items.some(item => 
            item.serialNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
            item.model?.toLowerCase().includes(searchText.toLowerCase()) ||
            item.system_sku?.toLowerCase().includes(searchText.toLowerCase()) ||
            item.cpu?.toLowerCase().includes(searchText.toLowerCase()) ||
            item.disks?.toLowerCase().includes(searchText.toLowerCase()) ||
            item.pay_method?.toLowerCase().includes(searchText.toLowerCase())
        );
    }, [searchText, dateRange]);

    const columns = [
        {
            title: 'Serial Number',
            dataIndex: 'serialNumber',
            key: 'serialNumber'
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
            title: 'Disks',
            dataIndex: 'disks',
            key: 'disks'
        },
        {
            title: 'Pay Method',
            dataIndex: 'pay_method',
            key: 'pay_method',
            width: 150,
            render: (text, record) => (
                <Select
                    defaultValue="-"
                    value={text === null ? '-' : text}
                    style={{ width: '100%' }}
                    onChange={(value) => handleSavePayMethod(record.id, value)}
                >
                    {paymentMethods.map(method => (
                        <Option key={method.value} value={method.value}>
                            {method.label}
                        </Option>
                    ))}
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
                            defaultValue={text}
                            autoFocus
                            onBlur={e => handleSavePrice(record.id, e.target.value)}
                            onPressEnter={e => {
                                e.preventDefault();
                                e.target.blur();
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
                render: (text, record) => {
                    const content = col.key === 'price' ? (text ? `$${text}` : '-') : (text || '-');
                    return record.is_deleted ? (
                        <span style={{ color: '#999' }}>{content}</span>
                    ) : content;
                }
            };
        }
        if (col.key === 'ram_gb') {
            return {
                ...col,
                render: (text, record) => record.is_deleted ? (
                    <span style={{ color: '#999' }}>{text || '-'}</span>
                ) : (text || '-')
            };
        }
        if (col.key === 'pay_method') {
            return {
                ...col,
                render: (text, record) => record.is_deleted ? (
                    <span style={{ color: '#999' }}>{formatPayMethod(text)}</span>
                ) : formatPayMethod(text)
            };
        }
        // For all other columns
        return {
            ...col,
            render: (text, record) => record.is_deleted ? (
                <span style={{ color: '#999' }}>{text || '-'}</span>
            ) : (text || '-')
        };
    });

    // Add Status column before Actions
    completedColumns.splice(completedColumns.length - 1, 0, {
        title: 'Status',
        key: 'status',
        render: (_, record) => record.is_deleted ? (
            <Tag color="default">Deleted</Tag>
        ) : null
    });

    // Add Return and Delete actions to completed columns
    completedColumns.push({
        title: 'Actions',
        key: 'actions',
        render: (_, record) => {
            if (record.is_deleted) return null;
            
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
                        <>
                            <Button 
                                type="link" 
                                danger
                                onClick={() => showDeleteConfirm(storeId, record.order?.id, record.id)}
                            >
                                Delete Item
                            </Button>
                            {record.order?.items?.length === 1 && (
                                <Button 
                                    type="link" 
                                    danger
                                    onClick={() => showDeleteConfirm(storeId, record.order.id)}
                                >
                                    Delete Order
                                </Button>
                            )}
                        </>
                    )}
                </Space>
            );
        }
    });

    const handlePrint = (order) => {
        setSelectedOrderForPrint(order);
        setIsPrintModalVisible(true);
    };

    const handlePrintConfirm = () => {
        window.print();
    };

    const handleDateRangeChange = (dates) => {
        setDateRange(dates);
    };

    const resetFilters = () => {
        setSearchText('');
        setDateRange(null);
    };

    return (
        <div className="store-orders-page">
            {/* Pending Order Section */}
            {pendingOrder && (
                <Card 
                    title="Pending Order" 
                    style={{ marginBottom: 16 }}
                    extra={
                        <Button 
                            type="primary" 
                            onClick={() => {
                                // Check for empty payment methods and prices
                                const hasEmptyPayMethods = pendingOrder.items.some(item => !item.pay_method);
                                const hasEmptyPrices = pendingOrder.items.some(item => !item.price);
                                
                                // If both are empty, show combined confirmation
                                if (hasEmptyPayMethods && hasEmptyPrices) {
                                    Modal.confirm({
                                        title: 'Missing Information',
                                        content: 'Some items do not have payment methods and prices set. Do you want to continue saving the order?',
                                        okText: 'Yes, Save Order',
                                        cancelText: 'Cancel',
                                        onOk: async () => {
                                            try {
                                                await orderService.saveOrder(storeId, pendingOrder.id);
                                                message.success('Order saved successfully');
                                                fetchOrders();
                                            } catch (error) {
                                                message.error('Failed to save order');
                                                console.error(error);
                                            }
                                        }
                                    });
                                    return;
                                }
                                
                                // If only payment methods are empty
                                if (hasEmptyPayMethods) {
                                    Modal.confirm({
                                        title: 'Missing Payment Methods',
                                        content: 'Some items do not have payment methods set. Do you want to continue saving the order?',
                                        okText: 'Yes, Save Order',
                                        cancelText: 'Cancel',
                                        onOk: async () => {
                                            try {
                                                await orderService.saveOrder(storeId, pendingOrder.id);
                                                message.success('Order saved successfully');
                                                fetchOrders();
                                            } catch (error) {
                                                message.error('Failed to save order');
                                                console.error(error);
                                            }
                                        }
                                    });
                                    return;
                                }
                                
                                // If only prices are empty
                                if (hasEmptyPrices) {
                                    Modal.confirm({
                                        title: 'Items Without Prices',
                                        content: 'Some items do not have prices set. Do you want to continue saving the order?',
                                        okText: 'Yes, Save Order',
                                        cancelText: 'Cancel',
                                        onOk: async () => {
                                            try {
                                                await orderService.saveOrder(storeId, pendingOrder.id);
                                                message.success('Order saved successfully');
                                                fetchOrders();
                                            } catch (error) {
                                                message.error('Failed to save order');
                                                console.error(error);
                                            }
                                        }
                                    });
                                    return;
                                }

                                // If all information is complete
                                Modal.confirm({
                                    title: 'Save Order',
                                    content: 'Are you sure you want to save this order?',
                                    okText: 'Yes',
                                    cancelText: 'No',
                                    onOk: async () => {
                                        try {
                                            await orderService.saveOrder(storeId, pendingOrder.id);
                                            message.success('Order saved successfully');
                                            fetchOrders();
                                        } catch (error) {
                                            message.error('Failed to save order');
                                            console.error(error);
                                        }
                                    }
                                });
                            }}
                        >
                            Save Order
                        </Button>
                    }
                >
                    <Table
                        dataSource={pendingOrder.items}
                        columns={columns}
                        rowKey={record => `pending-${record.recordId || record.id || Date.now()}`}
                        pagination={false}
                        summary={() => (
                            <Table.Summary fixed>
                                <Table.Summary.Row>
                                    <Table.Summary.Cell index={0} colSpan={columns.length - 1} align="right">
                                        <strong>Total:</strong>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={1}>
                                        <strong>
                                            ${pendingOrder.items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toFixed(2)}
                                        </strong>
                                    </Table.Summary.Cell>
                                </Table.Summary.Row>
                            </Table.Summary>
                        )}
                    />
                </Card>
            )}

            {/* Completed Orders Section */}
            <Card title="Completed Orders">
                <div style={{ marginBottom: 16 }}>
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Search
                            placeholder="Search orders..."
                            allowClear
                            onSearch={handleSearch}
                            style={{ width: 300 }}
                        />
                    </Space>
                </div>

                <Collapse>
                    {orders
                        .filter(order => order.status === 'completed')
                        .filter(filterOrders)
                        .map(order => (
                            <Panel 
                                key={order.id} 
                                header={`Order #${order.id} - ${new Date(order.created_at).toLocaleString()}`}
                                extra={
                                    <Space onClick={e => e.stopPropagation()}>
                                        {isAdmin() && (
                                            <Button
                                                type="primary"
                                                danger
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    showDeleteConfirm(storeId, order.id);
                                                }}
                                            >
                                                Delete Order
                                            </Button>
                                        )}
                                        <Button
                                            type="primary"
                                            icon={<PrinterOutlined />}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePrint(order);
                                            }}
                                        >
                                            Print Order
                                        </Button>
                                    </Space>
                                }
                            >
                                <Table
                                    dataSource={order.items}
                                    columns={completedColumns}
                                    rowKey="id"
                                    pagination={false}
                                />
                            </Panel>
                        ))}
                </Collapse>
            </Card>

            {/* Print Modal */}
            <Modal
                title="Print Order"
                visible={isPrintModalVisible}
                onOk={handlePrintConfirm}
                onCancel={() => setIsPrintModalVisible(false)}
                width={1000}
                bodyStyle={{ 
                    maxHeight: '85vh',
                    overflow: 'auto',
                    padding: '24px'
                }}
            >
                {selectedOrderForPrint && (
                    <PrintOrder order={selectedOrderForPrint} />
                )}
            </Modal>

            {/* RMA Reason Modal */}
            <Modal
                title="Enter RMA Reason"
                visible={showReasonModal}
                onOk={handleReasonSubmit}
                onCancel={() => setShowReasonModal(false)}
            >
                <Input.TextArea
                    value={reasonText}
                    onChange={e => setReasonText(e.target.value)}
                    placeholder="Enter reason for RMA"
                    rows={4}
                />
            </Modal>
        </div>
    );
};

export default StoreOrdersPage;