import React, { useState } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { rmaApi } from '../services/api';

const { TextArea } = Input;

const AddRmaModal = ({ visible, onCancel, onSuccess, storeId }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const values = await form.validateFields();
            
            const response = await rmaApi.addToRma(storeId, values);
            if (response?.success) {
                form.resetFields();
                onSuccess();
            }
        } catch (error) {
            console.error('Error adding RMA:', error);
            message.error('Failed to add RMA item');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title="Add RMA Item"
            open={visible}
            onCancel={onCancel}
            onOk={handleSubmit}
            confirmLoading={loading}
        >
            <Form
                form={form}
                layout="vertical"
            >
                <Form.Item
                    name="serialnumber"
                    label="Serial Number"
                    rules={[{ required: true, message: 'Please input serial number' }]}
                >
                    <Input />
                </Form.Item>

                <Form.Item
                    name="reason"
                    label="Reason"
                    rules={[{ required: true, message: 'Please input reason' }]}
                >
                    <TextArea rows={4} />
                </Form.Item>

                <Form.Item
                    name="notes"
                    label="Notes"
                >
                    <TextArea rows={4} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default AddRmaModal; 