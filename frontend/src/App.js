import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import InventoryPage from './pages/InventoryPage';
import StorePage from './pages/StorePage';
import OutboundPage from './pages/OutboundPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import { AuthProvider } from './contexts/AuthContext';

// Private Route Component
const PrivateRoute = ({ children }) => {
    const user = JSON.parse(localStorage.getItem('user'));
    return user ? children : <Navigate to="/login" />;
};

const App = () => {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={<Navigate to="/inventory" />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/inventory" element={
                        <PrivateRoute>
                            <Layout>
                                <InventoryPage />
                            </Layout>
                        </PrivateRoute>
                    } />
                    <Route path="/stores/:storeId" element={
                        <PrivateRoute>
                            <Layout>
                                <StorePage />
                            </Layout>
                        </PrivateRoute>
                    } />
                    <Route path="/outbound" element={
                        <PrivateRoute>
                            <Layout>
                                <OutboundPage />
                            </Layout>
                        </PrivateRoute>
                    } />
                    <Route path="/settings/*" element={
                        <PrivateRoute>
                            <Layout>
                                <SettingsPage />
                            </Layout>
                        </PrivateRoute>
                    } />
                    <Route path="*" element={<Navigate to="/inventory" />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
};

export default App; 