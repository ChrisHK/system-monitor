import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import InventoryPage from './pages/InventoryPage';
import StorePage from './pages/StorePage';
import OutboundPage from './pages/OutboundPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import StoreSalesPage from './pages/StoreSalesPage';
import StoreRmaPage from './pages/StoreRmaPage';
import StoreOrdersPage from './pages/StoreOrdersPage';
import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';

// Private Route Component
const PrivateRoute = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const location = useLocation();

    if (!isAuthenticated()) {
        // Save the attempted URL for redirecting after login
        return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }

    return children;
};

const App = () => {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/" element={
                        <PrivateRoute>
                            <Layout>
                                <InventoryPage />
                            </Layout>
                        </PrivateRoute>
                    } />
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
                    <Route path="/stores/:storeId/sales" element={
                        <PrivateRoute>
                            <Layout>
                                <StoreSalesPage />
                            </Layout>
                        </PrivateRoute>
                    } />
                    <Route path="/stores/:storeId/orders" element={
                        <PrivateRoute>
                            <Layout>
                                <StoreOrdersPage />
                            </Layout>
                        </PrivateRoute>
                    } />
                    <Route path="/stores/:storeId/rma" element={
                        <PrivateRoute>
                            <Layout>
                                <StoreRmaPage />
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
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
};

export default App; 