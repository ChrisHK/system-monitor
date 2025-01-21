import React from 'react';
import { Modal, Form, DatePicker, message } from 'antd';
import moment from 'moment';

const { RangePicker } = DatePicker;

const ExportDateRangeModal = ({ visible, onCancel, onExport }) => {
    const [form] = Form.useForm();

    const handleExport = async () => {
        try {
            const values = await form.validateFields();
            const [startDate, endDate] = values.dateRange;
            
            // Format dates as ISO strings
            const formattedStartDate = startDate.startOf('day').toISOString();
            const formattedEndDate = endDate.endOf('day').toISOString();
            
            await onExport(formattedStartDate, formattedEndDate);
            form.resetFields();
            onCancel();
        } catch (error) {
            console.error('Error exporting:', error);
            message.error('Please select a valid date range');
        }
    };

    return (
        <Modal
            title="Export Orders"
            open={visible}
            onCancel={onCancel}
            onOk={handleExport}
            okText="Export"
        >
            <Form
                form={form}
                layout="vertical"
            >
                <Form.Item
                    name="dateRange"
                    label="Date Range"
                    rules={[{ required: true, message: 'Please select date range' }]}
                >
                    <RangePicker
                        style={{ width: '100%' }}
                        ranges={{
                            'Today': [moment(), moment()],
                            'This Week': [moment().startOf('week'), moment().endOf('week')],
                            'This Month': [moment().startOf('month'), moment().endOf('month')],
                            'Last Month': [moment().subtract(1, 'months').startOf('month'), moment().subtract(1, 'months').endOf('month')]
                        }}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default ExportDateRangeModal; 