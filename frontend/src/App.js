import React, { useEffect } from 'react';
import { Layout } from 'antd';
import { wsService } from './services/websocket';
import InventoryPage from './pages/InventoryPage';
import Sidebar from './components/Sidebar';

const { Content, Sider } = Layout;

function App() {
    useEffect(() => {
        console.log('Initializing WebSocket connection...');
        wsService.connect();

        return () => {
            console.log('Cleaning up WebSocket connection...');
            wsService.disconnect();
        };
    }, []);

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider
                width={200}
                style={{
                    background: '#fff',
                    padding: '20px 0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}
            >
                <Sidebar />
            </Sider>
            <Layout>
                <Content style={{ padding: '20px', minHeight: 280 }}>
                    <InventoryPage />
                </Content>
            </Layout>
        </Layout>
    );
}

export default App; 