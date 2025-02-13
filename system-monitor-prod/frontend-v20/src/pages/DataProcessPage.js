import React from 'react';
import { Card, Space, Button, Upload, message } from 'antd';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';

const DataProcessPage = () => {
    // 處理文件上傳
    const handleUpload = (info) => {
        if (info.file.status === 'done') {
            message.success(`${info.file.name} file uploaded successfully`);
        } else if (info.file.status === 'error') {
            message.error(`${info.file.name} file upload failed.`);
        }
    };

    // 處理數據導出
    const handleExport = () => {
        // TODO: 實現數據導出功能
        message.info('Export functionality will be implemented soon');
    };

    return (
        <div>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Card title="Data Import" size="small">
                    <Upload
                        name="file"
                        action="/api/upload"
                        onChange={handleUpload}
                    >
                        <Button icon={<UploadOutlined />}>Import Data</Button>
                    </Upload>
                </Card>

                <Card title="Data Export" size="small">
                    <Button 
                        icon={<DownloadOutlined />}
                        onClick={handleExport}
                    >
                        Export Data
                    </Button>
                </Card>
            </Space>
        </div>
    );
};

export default DataProcessPage; 