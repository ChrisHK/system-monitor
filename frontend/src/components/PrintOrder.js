import React from 'react';
import { Typography } from 'antd';
import './PrintOrder.css';

const { Title } = Typography;

const PrintOrder = ({ order }) => {
    const calculateTotal = (items) => {
        // 檢查是否所有項目的價格都是 null
        const allPricesNull = items.every(item => item.price === null);
        if (allPricesNull) {
            return '-';
        }
        return items.reduce((total, item) => total + (parseFloat(item.price) || 0), 0);
    };

    if (!order || !order.items) {
        return <div>No order data available</div>;
    }

    const total = calculateTotal(order.items);

    return (
        <div className="print-container">
            <div className="print-header">
                <Title level={2}>ZEROUNIQUE COMPUTER</Title>
                <div className="order-info">
                    <p>Order #{order.id} - {new Date(order.created_at).toLocaleString()}</p>
                </div>
            </div>

            <div className="print-content">
                <table className="print-table">
                    <thead>
                        <tr>
                            <th>Serial Number</th>
                            <th>Model</th>
                            <th>System SKU</th>
                            <th>CPU</th>
                            <th>RAM (GB)</th>
                            <th>Disks</th>
                            <th>Pay Method</th>
                            <th>Price</th>
                            <th>Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items.map((item, index) => (
                            <tr key={index}>
                                <td>{item.serialNumber}</td>
                                <td>{item.model}</td>
                                <td>{item.system_sku}</td>
                                <td>{item.cpu}</td>
                                <td>{item.ram_gb || '-'}</td>
                                <td>{item.disks}</td>
                                <td>{item.pay_method === null ? '-' : item.pay_method}</td>
                                <td>{item.price === null ? '-' : `$${item.price || 0}`}</td>
                                <td>1</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan="7" style={{ textAlign: 'right' }}>Total:</td>
                            <td colSpan="2">{total === '-' ? '-' : `$${total.toFixed(2)}`}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="print-footer">
                <p>Thank you for shopping with us!</p>
                <p>ZeroUnique Computer</p>
                <p>250 Shields Court #11, Markham ON L3R 9T5, Canada</p>
                <p>info@zerounique.com</p>
                <p>zerounique.com</p>
            </div>
        </div>
    );
};

export default PrintOrder; 