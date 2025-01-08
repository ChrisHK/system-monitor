import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import Sidebar from './components/Sidebar';
import InventoryPage from './pages/InventoryPage';
import StorePage from './pages/StorePage';
import OutboundPage from './pages/OutboundPage';
import SettingsPage from './pages/SettingsPage';

const { Content } = Layout;

function App() {
    return (
        <Router>
            <Layout style={{ minHeight: '100vh' }}>
                <Sidebar />
                <Layout>
                    <Content style={{ margin: '0 16px' }}>
                        <Routes>
                            <Route path="/" element={<InventoryPage />} />
                            <Route path="/store/:storeId" element={<StorePage />} />
                            <Route path="/outbound" element={<OutboundPage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                        </Routes>
                    </Content>
                </Layout>
            </Layout>
        </Router>
    );
}

export default App; 