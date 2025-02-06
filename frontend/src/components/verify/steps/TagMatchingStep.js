import React from 'react';
import { Alert } from 'antd';

const TagMatchingStep = () => {
    return (
        <div>
            <Alert
                message="Tag Matching"
                description="Match category values to corresponding tags."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
            />
            <div>Tag Matching Step (Coming Soon)</div>
        </div>
    );
};

export default TagMatchingStep; 