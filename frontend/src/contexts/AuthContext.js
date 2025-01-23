import React, { createContext, useState, useContext, useCallback, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadUser = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const response = await api.get('/users/me');
                    if (response?.success) {
                        setUser(response.user);
                    } else {
                        // Clear invalid session
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                    }
                } catch (error) {
                    console.error('Error loading user:', error);
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                }
            }
            setLoading(false);
        };

        loadUser();
    }, []);

    const login = useCallback(async (username, password) => {
        // Clear any existing auth data before new login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);

        try {
            const response = await api.post('/users/login', { username, password });
            
            if (response?.success) {
                const { token, user } = response;
                // Set user first to prevent race condition
                setUser(user);
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(user));
                return { success: true };
            }
            
            return { 
                success: false, 
                error: response?.error || 'Login failed' 
            };
        } catch (error) {
            console.error('Login error:', error.response?.data || error.message);
            return { 
                success: false, 
                error: error.response?.data?.error || error.message || 'Login failed' 
            };
        }
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    }, []);

    const isAdmin = useCallback(() => {
        return user?.group_name === 'admin';
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

export default AuthContext; 