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
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
        delete api.defaults.headers.common['Authorization'];
    }, []);

    // Initialize auth state
    useEffect(() => {
        const initializeAuth = async () => {
            // Prevent multiple initializations in development mode
            if (initRef.current) {
                console.log('Auth already initialized, skipping...');
                return;
            }
            initRef.current = true;

            try {
                console.log('Initializing auth...');
                const token = localStorage.getItem('token');
                const storedUser = localStorage.getItem('user');

                if (token && storedUser) {
                    try {
                        console.log('Found stored credentials');
                        const parsedUser = JSON.parse(storedUser);
                        
                        if (parsedUser && parsedUser.username && parsedUser.role) {
                            // Set axios default headers first
                            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                            
                            // Set user state first
                            setUser(parsedUser);
                            
                            // Verify token after setting state
                            try {
                                const checkResponse = await api.get('/users/me');
                                if (!checkResponse?.data?.user) {
                                    throw new Error('Token validation failed');
                                }
                                console.log('Auth initialized successfully');
                            } catch (error) {
                                console.error('Token validation error:', error);
                                clearAuthData();
                            }
                        } else {
                            console.error('Invalid stored user data');
                            clearAuthData();
                        }
                    } catch (parseError) {
                        console.error('Failed to parse stored user data:', parseError);
                        clearAuthData();
                    }
                } else {
                    console.log('No stored credentials found');
                    clearAuthData();
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
                clearAuthData();
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();

        // Add event listener for storage changes
        const handleStorageChange = (e) => {
            if (e.key === 'token' || e.key === 'user') {
                // Reset initRef when storage changes
                initRef.current = false;
                initializeAuth();
            }
        };
        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [clearAuthData]);

    const login = async (token, userData) => {
        console.log('Setting user data:', userData);
        
        if (!userData || !token) {
            console.error('Invalid login data provided');
            return false;
        }

        // Validate required fields
        if (!userData.username || !userData.role) {
            console.error('Missing required user data fields');
            return false;
        }

        try {
            // First set the token in axios headers
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            // Then verify token with backend
            try {
                const checkResponse = await api.get('/users/me');
                if (!checkResponse?.data?.user) {
                    throw new Error('Token validation failed');
                }

                // If token is valid, set user state and localStorage
                setUser(userData);
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(userData));
                
                console.log('Auth state updated:', {
                    user: userData,
                    token: token ? 'exists' : 'missing',
                    headers: axios.defaults.headers.common['Authorization']
                });

                return true;
            } catch (checkError) {
                console.error('Token validation error:', checkError);
                clearAuthData();
                return false;
            }
        } catch (error) {
            console.error('Failed to set auth state:', error);
            clearAuthData();
            return false;
        }
    };

    const logout = useCallback(() => {
        console.log('Logging out...');
        clearAuthData();
        // Use replace to prevent back navigation to protected routes
        window.location.replace('/login');
    }, [clearAuthData]);

    const isAdmin = useCallback(() => {
        const isAdminUser = user?.role === 'admin';
        console.log('Checking admin status:', { 
            user, 
            role: user?.role,
            isAdmin: isAdminUser
        });
        return isAdminUser;
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