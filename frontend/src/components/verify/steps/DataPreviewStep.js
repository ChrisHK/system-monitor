import React from 'react';
import { Alert } from 'antd';

const DataPreviewStep = () => {
    return (
        <div>
            <Alert
                message="Data Preview"
                description="Review the processed data before creating the purchase order."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
            />
            <div>Data Preview Step (Coming Soon)</div>
        </div>
    );
};

export default DataPreviewStep; 