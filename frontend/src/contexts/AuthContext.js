import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import { authService } from '../api';
import { Spin } from 'antd';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const refreshUser = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            if (!authService.isAuthenticated()) {
                setUser(null);
                return;
            }

            const response = await authService.checkAuth();
            
            if (!response?.success) {
                throw new Error(response?.error || 'Authentication check failed');
            }
            
            setUser(response.user);
            return response.user;
        } catch (error) {
            console.error('Error refreshing user:', error);
            setError(error.message || 'Failed to refresh user');
            await authService.logout();
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    const login = useCallback(async (username, password) => {
        try {
            setError(null);
            setLoading(true);
            
            const response = await authService.login({ username, password });
            
            if (!response?.success) {
                throw new Error(response?.error || 'Login failed');
            }
            
            setUser(response.user);
            return { success: true };
        } catch (error) {
            console.error('Login error:', error);
            setError(error.message || 'Login failed');
            return { 
                success: false, 
                error: error.message || 'Login failed' 
            };
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            setLoading(true);
            await authService.logout();
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            setUser(null);
            setError(null);
            setLoading(false);
        }
    }, []);

    const isAdmin = useCallback(() => {
        return user?.group_name === 'admin';
    }, [user]);

    const isAuthenticated = useCallback(() => {
        const hasUser = !!user;
        const hasToken = authService.isAuthenticated();
        return hasUser && hasToken;
    }, [user]);

    if (loading) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh' 
            }}>
                <div style={{ textAlign: 'center' }}>
                    <Spin size="large" />
                    <div style={{ marginTop: 16 }}>Loading...</div>
                </div>
            </div>
        );
    }

    const value = {
        user,
        login,
        logout,
        isAdmin,
        isAuthenticated,
        error,
        loading,
        refreshUser
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext; 