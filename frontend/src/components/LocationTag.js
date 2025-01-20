import React from 'react';
import { Tag } from 'antd';

const LocationTag = ({ location, style = {} }) => {
    if (!location) {
        return <Tag color="default">Unknown</Tag>;
    }

    const baseStyle = { minWidth: '80px', textAlign: 'center', ...style };

    if (location.location === 'store') {
        return (
            <Tag color="blue" style={baseStyle}>
                {location.storeName || 'Store'}
            </Tag>
        );
    }

    if (location.location === 'inventory') {
        return (
            <Tag color="green" style={baseStyle}>
                Inventory
            </Tag>
        );
    }

    return (
        <Tag color="default" style={baseStyle}>
            {location.location || 'Unknown'}
        </Tag>
    );
};

export default React.memo(LocationTag); 