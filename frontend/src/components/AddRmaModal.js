import React, { useState } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { rmaApi } from '../services/api';

const { TextArea } = Input;

const AddRmaModal = ({ visible, onCancel, onSuccess, storeId }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);

            const response = await rmaApi.addToRma(storeId, {
                recordId: values.recordId,
                reason: values.reason || '',
                notes: values.notes || ''
            });

            if (response.success) {
                form.resetFields();
                onSuccess();
            }
        } catch (error) {
            if (error.errorFields) {
                // Form validation error
                return;
            }
            message.error(error.message || 'Failed to add RMA item');
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
                initialValues={{
                    reason: '',
                    notes: ''
                }}
            >
                <Form.Item
                    name="recordId"
                    label="Serial Number"
                    rules={[{ required: true, message: 'Please enter serial number' }]}
                >
                    <Input placeholder="Enter serial number" />
                </Form.Item>

                <Form.Item
                    name="reason"
                    label="Reason"
                    rules={[{ required: true, message: 'Please enter reason' }]}
                >
                    <Input.TextArea placeholder="Enter reason" rows={4} />
                </Form.Item>

                <Form.Item
                    name="notes"
                    label="Notes"
                >
                    <Input.TextArea placeholder="Enter notes (optional)" rows={4} />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default AddRmaModal; 