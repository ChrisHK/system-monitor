import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const initRef = useRef(false);

    // Helper function to clear auth data
    const clearAuthData = useCallback(() => {
        console.log('Clearing auth data');
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
        delete api.defaults.headers.common['Authorization'];
    }, []);

    // Initialize auth state
    useEffect(() => {
        const initializeAuth = async () => {
            if (initRef.current) {
                return;
            }
            initRef.current = true;

            try {
                const token = localStorage.getItem('token');
                const storedUser = localStorage.getItem('user');

                if (!token || !storedUser) {
                    console.log('No stored credentials found');
                    clearAuthData();
                    if (window.location.pathname !== '/login') {
                        window.location.replace('/login');
                    }
                    return;
                }

                try {
                    const parsedUser = JSON.parse(storedUser);
                    
                    // Set auth headers
                    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                    
                    // Set initial user state
                    setUser(parsedUser);
                    
                    // Verify token
                    try {
                        const checkResponse = await api.get('/users/me');
                        
                        if (checkResponse?.data?.success) {
                            const userData = checkResponse.data.user;
                            setUser(userData);
                            localStorage.setItem('user', JSON.stringify(userData));
                        } else {
                            // Token validation failed but we still have stored credentials
                            // Keep the user logged in with stored data
                            console.warn('Token validation failed, using stored credentials');
                            setUser(parsedUser);
                        }
                    } catch (apiError) {
                        // API error but we still have stored credentials
                        // Keep the user logged in with stored data
                        console.warn('API validation error, using stored credentials:', apiError);
                        setUser(parsedUser);
                    }
                } catch (parseError) {
                    console.error('Failed to parse stored user data:', parseError);
                    clearAuthData();
                    if (window.location.pathname !== '/login') {
                        window.location.replace('/login');
                    }
                }
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();
    }, [clearAuthData]);

    const login = async (token, userData) => {
        console.log('Setting user data:', userData);
        
        if (!userData || !token) {
            console.error('Invalid login data provided');
            return false;
        }

        if (!userData.username || !userData.role) {
            console.error('Missing required user data fields');
            return false;
        }

        try {
            // First set the token in axios headers
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            // Store credentials
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);
            
            console.log('Auth state updated:', {
                user: userData,
                token: token ? 'exists' : 'missing',
                headers: axios.defaults.headers.common['Authorization']
            });

            return true;
        } catch (error) {
            console.error('Failed to set auth state:', error);
            clearAuthData();
            throw error;
        }
    };

    const logout = useCallback(() => {
        console.log('Logging out...');
        clearAuthData();
        window.location.replace('/login');
    }, [clearAuthData]);

    const isAdmin = useCallback(() => {
        return user?.role === 'admin';
    }, [user]);

    const isAuthenticated = useCallback(() => {
        const token = localStorage.getItem('token');
        const hasUser = !!user;
        const hasToken = !!token;
        
        console.log('Checking authentication status:', { 
            hasUser,
            hasToken,
            user
        });
        
        return hasUser && hasToken;
    }, [user]);

    if (loading) {
        return <div>Loading...</div>;
    }

    const value = {
        user,
        login,
        logout,
        isAdmin,
        isAuthenticated
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext; 