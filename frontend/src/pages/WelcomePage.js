import React from 'react';
import { Typography } from 'antd';

const { Title } = Typography;

const WelcomePage = () => {
    return (
        <div style={{ 
            padding: 24,
            minHeight: '100vh',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        }}>
            <Title level={1}>Welcome to the Zerounique system</Title>
        </div>
    );
};

export default WelcomePage; 