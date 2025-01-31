import axios from 'axios';

// Use the environment variable for API URL
const API_BASE_URL = (() => {
    // Get the current hostname
    const currentHostname = window.location.hostname;
    const apiUrl = process.env.REACT_APP_API_URL;
    
    // If accessing from another machine, ensure we use the server's IP
    if (currentHostname !== 'localhost' && currentHostname !== '127.0.0.1') {
        return 'http://192.168.0.10:4000/api';
    }
    
    return apiUrl || 'http://localhost:4000/api';
})();

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Request interceptor
api.interceptors.request.use(
    (config) => {
        // Skip token for login and public endpoints
        if (config.url === '/users/login') {
            return config;
        }

        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        
        if (process.env.NODE_ENV === 'development') {
            console.log('API Request:', {
                url: config.url,
                method: config.method,
                headers: config.headers
            });
        }
        
        return config;
    },
    (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor
api.interceptors.response.use(
    (response) => {
        if (process.env.NODE_ENV === 'development') {
            console.log('API Response:', {
                url: response.config.url,
                status: response.status,
                success: response.data?.success
            });
        }
        return response.data;
    },
    (error) => {
        // Handle authentication errors
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Don't redirect if already on login page
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        }
        
        if (process.env.NODE_ENV === 'development') {
            console.error('API Error:', {
                url: error.config?.url,
                status: error.response?.status,
                message: error.message,
                data: error.response?.data
            });
        }

        return Promise.reject(error);
    }
);

// Services
export { default as authService } from './services/auth.service';
export { default as userService } from './services/user.service';
export { default as inventoryService } from './services/inventory.service';
export { default as storeService } from './services/store.service';
export { default as rmaService } from './services/rma.service';
export { default as orderService } from './services/order.service';
export { default as salesService } from './services/sales.service';

// Utils
export { ApiError, ERROR_CODES } from './utils/errorHandler';
export { createQueryString, downloadFile } from './utils/apiUtils';

// Config
export { api } from './config/axios';
export { ENDPOINTS } from './config/endpoints';

export default api; 