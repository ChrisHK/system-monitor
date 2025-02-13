import React, { useEffect } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false, requireStore = false }) => {
    const { user, isAdmin, isAuthenticated } = useAuth();
    const location = useLocation();
    const { storeId } = useParams();

    useEffect(() => {
        console.log('ProtectedRoute state:', {
            path: location.pathname,
            user,
            isAuthenticated: isAuthenticated(),
            isAdmin: isAdmin(),
            adminOnly,
            userGroup: user?.group,
            storeId,
            requireStore,
            hasStorePermission: user?.permitted_stores?.includes(Number(storeId))
        });
    }, [location.pathname, user, isAuthenticated, isAdmin, adminOnly, storeId, requireStore]);

    // First check authentication
    if (!isAuthenticated()) {
        console.log('Not authenticated, redirecting to login');
        return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }

    // Then check authorization
    if (adminOnly && !isAdmin()) {
        console.log('Admin access required but user is not in admin group');
        return <Navigate to="/" replace />;
    }

    // Verify user data integrity
    if (!user || !user.group) {
        console.log('Invalid user data, clearing session');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return <Navigate to="/login" replace />;
    }

    // Check store permission if required
    if (requireStore && storeId) {
        const hasStorePermission = isAdmin() || user.permitted_stores?.includes(Number(storeId));
        if (!hasStorePermission) {
            console.log('No permission for store:', storeId);
            return <Navigate to="/inventory" replace />;
        }
    }

    console.log('Access granted to:', location.pathname);
    return children;
};

export default ProtectedRoute; 