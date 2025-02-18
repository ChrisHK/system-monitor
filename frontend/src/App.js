import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import InventoryPage from './pages/InventoryPage';
import StorePage from './pages/StorePage';
import OutboundPage from './pages/OutboundPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import StoreSalesPage from './pages/StoreSalesPage';
import StoreRmaPage from './pages/StoreRmaPage';
import StoreOrdersPage from './pages/StoreOrdersPage';
import InventoryRmaPage from './pages/InventoryRmaPage';
import PurchaseOrderPage from './pages/PurchaseOrderPage';
import AddEditPOPage from './pages/AddEditPOPage';
import PODetailPage from './pages/PODetailPage';
import WelcomePage from './pages/WelcomePage';
import InboundItemsPage from './pages/InboundItemsPage';
import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';

// Private Route Component
const PrivateRoute = ({ children, requireStore }) => {
    const { isAuthenticated } = useAuth();
    const location = useLocation();

    if (!isAuthenticated()) {
        // Save the attempted URL for redirecting after login
        return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }

    if (requireStore && !isAuthenticated('store')) {
        return <Navigate to="/" replace />;
    }

    return children;
};

const App = () => {
    return (
        <Router>
            <AuthProvider>
                <NotificationProvider>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/" element={
                            <PrivateRoute>
                                <Layout>
                                    <WelcomePage />
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
                        <Route path="/inventory/rma" element={
                            <PrivateRoute>
                                <Layout>
                                    <InventoryRmaPage />
                                </Layout>
                            </PrivateRoute>
                        } />
                        <Route path="/inbound/purchase-order" element={
                            <PrivateRoute>
                                <Layout>
                                    <PurchaseOrderPage />
                                </Layout>
                            </PrivateRoute>
                        } />
                        <Route path="/inbound/purchase-order/add" element={
                            <PrivateRoute>
                                <Layout>
                                    <AddEditPOPage />
                                </Layout>
                            </PrivateRoute>
                        } />
                        <Route path="/inbound/purchase-order/edit/:id" element={
                            <PrivateRoute>
                                <Layout>
                                    <AddEditPOPage />
                                </Layout>
                            </PrivateRoute>
                        } />
                        <Route path="/inbound/purchase-order/detail/:id" element={
                            <PrivateRoute>
                                <Layout>
                                    <PODetailPage />
                                </Layout>
                            </PrivateRoute>
                        } />
                        <Route path="/stores/:storeId" element={
                            <PrivateRoute requireStore>
                                <Layout>
                                    <StorePage />
                                </Layout>
                            </PrivateRoute>
                        } />
                        <Route path="/stores/:storeId/sales" element={
                            <PrivateRoute requireStore>
                                <Layout>
                                    <StoreSalesPage />
                                </Layout>
                            </PrivateRoute>
                        } />
                        <Route path="/stores/:storeId/orders" element={
                            <PrivateRoute requireStore>
                                <Layout>
                                    <StoreOrdersPage />
                                </Layout>
                            </PrivateRoute>
                        } />
                        <Route path="/stores/:storeId/rma" element={
                            <PrivateRoute requireStore>
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
                        <Route path="/inbound/items" element={
                            <PrivateRoute>
                                <Layout>
                                    <InboundItemsPage />
                                </Layout>
                            </PrivateRoute>
                        } />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </NotificationProvider>
            </AuthProvider>
        </Router>
    );
};

export default App; 