import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Layout } from 'antd';
import Sidebar from './components/Sidebar';
import InventoryPage from './pages/InventoryPage';
import OutboundPage from './pages/OutboundPage';
import StorePage from './pages/StorePage';

const { Content, Sider } = Layout;

function App() {
    return (
        <Router>
            <Layout style={{ minHeight: '100vh' }}>
                <Sider width={200} theme="light">
                    <Sidebar />
                </Sider>
                <Layout>
                    <Content style={{ padding: '24px', minHeight: 280 }}>
                        <Routes>
                            <Route path="/" element={<InventoryPage />} />
                            <Route path="/inventory" element={<InventoryPage />} />
                            <Route path="/outbound" element={<OutboundPage />} />
                            <Route path="/store/:storeId" element={<StorePage />} />
                        </Routes>
                    </Content>
                </Layout>
            </Layout>
        </Router>
    );
}

export default App; 