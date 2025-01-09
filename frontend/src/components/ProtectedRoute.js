import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false }) => {
    const { user, isAdmin, isAuthenticated } = useAuth();
    const location = useLocation();

    useEffect(() => {
        console.log('ProtectedRoute state:', {
            path: location.pathname,
            user,
            isAuthenticated: isAuthenticated(),
            isAdmin: isAdmin(),
            adminOnly,
            userRole: user?.role
        });
    }, [location.pathname, user, isAuthenticated, isAdmin, adminOnly]);

    // First check authentication
    if (!isAuthenticated()) {
        console.log('Not authenticated, redirecting to login');
        return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }

    // Then check authorization
    if (adminOnly && !isAdmin()) {
        console.log('Admin access required but user is not admin');
        return <Navigate to="/" replace />;
    }

    // Verify user data integrity
    if (!user || !user.role) {
        console.log('Invalid user data, clearing session');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return <Navigate to="/login" replace />;
    }

    console.log('Access granted to:', location.pathname);
    return children;
};

export default ProtectedRoute; 