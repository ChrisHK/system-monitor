import React from 'react';
import { 
    Modal, 
    Table, 
    Typography, 
    Descriptions, 
    Space,
    Tag
} from 'antd';
import dayjs from 'dayjs';

const { Title } = Typography;

const PurchaseOrderDetail = ({ 
    visible, 
    onClose, 
    orderData,
    detailData = [] 
}) => {
    // Table columns for the detail data
    const columns = [
        {
            title: 'Item No.',
            dataIndex: 'itemNo',
            key: 'itemNo'
        },
        {
            title: 'Description',
            dataIndex: 'description',
            key: 'description'
        },
        {
            title: 'Quantity',
            dataIndex: 'quantity',
            key: 'quantity',
            render: (text) => Number(text).toLocaleString()
        },
        {
            title: 'Unit Price',
            dataIndex: 'unitPrice',
            key: 'unitPrice',
            render: (text) => `$${Number(text).toFixed(2)}`
        },
        {
            title: 'Total Amount',
            dataIndex: 'totalAmount',
            key: 'totalAmount',
            render: (text) => `$${Number(text).toFixed(2)}`
        },
        {
            title: 'Supplier',
            dataIndex: 'supplier',
            key: 'supplier'
        },
        {
            title: 'Remark',
            dataIndex: 'remark',
            key: 'remark'
        }
    ];

    return (
        <Modal
            title={<Title level={4}>Purchase Order Detail</Title>}
            open={visible}
            onCancel={onClose}
            width={1200}
            footer={null}
        >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Descriptions bordered>
                    <Descriptions.Item label="PO Name">{orderData?.poName}</Descriptions.Item>
                    <Descriptions.Item label="PO Date">
                        {orderData?.poDate ? dayjs(orderData.poDate).format('YYYY-MM-DD') : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Status">
                        <Tag color={orderData?.poStatus === 'pending' ? 'gold' : 'green'}>
                            {orderData?.poStatus?.toUpperCase() || 'UNKNOWN'}
                        </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Total Amount">
                        ${orderData?.poAmount?.toFixed(2) || '0.00'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Created By">
                        {orderData?.createdBy || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Updated At">
                        {orderData?.updatedAt ? dayjs(orderData.updatedAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
                    </Descriptions.Item>
                </Descriptions>

                {orderData?.poNote && (
                    <Descriptions bordered>
                        <Descriptions.Item label="Note" span={3}>
                            {orderData.poNote}
                        </Descriptions.Item>
                    </Descriptions>
                )}

                <Table
                    columns={columns}
                    dataSource={detailData}
                    rowKey="itemNo"
                    pagination={false}
                    scroll={{ y: 400 }}
                />
            </Space>
        </Modal>
    );
};

export default PurchaseOrderDetail; 