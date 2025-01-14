import axios from 'axios';

// Get the API base URL from environment variables or construct it
const API_HOST = process.env.REACT_APP_API_HOST || '192.168.0.10';
const API_PORT = process.env.REACT_APP_API_PORT || '4000';
const DEFAULT_API_URL = `http://${API_HOST}:${API_PORT}`;

// Get the complete API URL or use constructed default
const API_BASE_URL = process.env.REACT_APP_API_URL || DEFAULT_API_URL;

// Remove /api from the end of the base URL if it exists
const normalizedBaseURL = API_BASE_URL.endsWith('/api') 
    ? API_BASE_URL.slice(0, -4) 
    : API_BASE_URL;

// Create axios instance with default config
const api = axios.create({
    baseURL: `${normalizedBaseURL}/api`,
    timeout: 10000,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
});

// Request interceptor for adding auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        // Remove any duplicate /api in the URL
        if (config.url && config.url.startsWith('/api/')) {
            config.url = config.url.replace('/api/', '/');
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for handling errors
api.interceptors.response.use(
    (response) => {
        // Transform successful responses
        if (response.data) {
            return {
                ...response,
                data: {
                    success: true,
                    ...response.data
                }
            };
        }
        return response;
    },
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Inventory Management
export const getInventoryRecords = (params) => api.get('/records', { params });
export const getDuplicateRecords = () => api.get('/records/duplicates');
export const searchRecords = (query) => api.get(`/records/search?q=${query}`);
export const updateRecord = (id, data) => api.put(`/records/${id}`, data);
export const deleteRecord = (id) => api.delete(`/records/${id}`);
export const addRecord = (data) => api.post('/records', data);
export const importRecords = (formData) => api.post('/records/import', formData, {
    headers: {
        'Content-Type': 'multipart/form-data'
    }
});
export const exportRecords = (params) => api.get('/records/export', { 
    params,
    responseType: 'blob' 
});

// Store Management
export const getStoreItems = (storeId) => api.get(`/stores/${storeId}/items`);
export const deleteStoreItem = (storeId, itemId) => api.delete(`/stores/${storeId}/items/${itemId}`);
export const exportStoreItems = (storeId) => api.get(`/stores/${storeId}/export`, { responseType: 'blob' });
export const getStores = () => api.get('/stores');
export const checkStoreItems = (storeId, serialNumbers) => api.post(`/stores/${storeId}/check`, { serialNumbers });
export const sendToStore = (storeId, items) => api.post(`/stores/${storeId}/outbound`, { items });

// Outbound Management
export const getOutboundItems = () => api.get('/outbound/items');
export const addToOutbound = (recordId) => api.post('/outbound/items', { recordId });
export const removeFromOutbound = (itemId) => api.delete(`/outbound/items/${itemId}`);
export const checkItemLocation = (serialNumber) => api.get(`/records/check-location/${serialNumber}`);

// Default export for general API calls
export default api; 