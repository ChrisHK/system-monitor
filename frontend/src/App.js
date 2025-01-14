import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';

import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import InventoryPage from './pages/InventoryPage';
import OutboundPage from './pages/OutboundPage';
import SettingsPage from './pages/SettingsPage';
import StorePage from './pages/StorePage';

function App() {
    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <AuthProvider>
                <Router>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <Layout>
                                        <InventoryPage />
                                    </Layout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/inventory"
                            element={
                                <ProtectedRoute>
                                    <Layout>
                                        <InventoryPage />
                                    </Layout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/outbound"
                            element={
                                <ProtectedRoute>
                                    <Layout>
                                        <OutboundPage />
                                    </Layout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/stores/:storeId"
                            element={
                                <ProtectedRoute>
                                    <Layout>
                                        <StorePage />
                                    </Layout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/settings/*"
                            element={
                                <ProtectedRoute adminOnly>
                                    <Layout>
                                        <SettingsPage />
                                    </Layout>
                                </ProtectedRoute>
                            }
                        />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Router>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App; 