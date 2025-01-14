import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const initializeAuth = async () => {
            try {
                console.log('Initializing auth...');
                const token = localStorage.getItem('token');
                const storedUser = localStorage.getItem('user');

                if (token && storedUser) {
                    try {
                        console.log('Found stored credentials');
                        const parsedUser = JSON.parse(storedUser);
                        console.log('Stored user data:', parsedUser);
                        
                        if (parsedUser && parsedUser.username && parsedUser.role) {
                            setUser(parsedUser);
                            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                            console.log('Auth initialized successfully');
                        } else {
                            console.error('Invalid stored user data');
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                        }
                    } catch (parseError) {
                        console.error('Failed to parse stored user data:', parseError);
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                    }
                } else {
                    console.log('No stored credentials found');
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();
    }, []);

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
            // Set user state and localStorage
            setUser(userData);
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(userData));

            // Set axios default headers
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            
            console.log('Auth state updated:', {
                user: userData,
                token: token ? 'exists' : 'missing',
                headers: axios.defaults.headers.common['Authorization']
            });

            return true;
        } catch (error) {
            console.error('Failed to set auth state:', error);
            return false;
        }
    };

    const logout = () => {
        console.log('Logging out...');
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
        window.location.href = '/login';
    };

    const isAdmin = () => {
        const isAdminUser = user?.role === 'admin';
        console.log('Checking admin status:', { 
            user, 
            role: user?.role,
            isAdmin: isAdminUser
        });
        return isAdminUser;
    };

    const isAuthenticated = () => {
        const token = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        const hasUser = !!user;
        const hasToken = !!token;
        const hasStoredUser = !!storedUser;
        
        try {
            if (storedUser) {
                const parsedUser = JSON.parse(storedUser);
                if (!parsedUser.username || !parsedUser.role) {
                    console.error('Invalid stored user data');
                    return false;
                }
            }
        } catch (error) {
            console.error('Failed to parse stored user data');
            return false;
        }
        
        console.log('Checking authentication status:', { 
            hasUser,
            hasToken,
            hasStoredUser,
            user,
            token: token ? 'exists' : 'missing'
        });
        
        return hasUser && hasToken && hasStoredUser;
    };

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