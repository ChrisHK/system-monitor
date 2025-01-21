import axios from 'axios';

const api = axios.create({
    baseURL: 'http://192.168.0.10:4000/api',
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    }
});

// Add request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        console.log('API Request:', {
            url: config.url,
            method: config.method,
            params: config.params,
            headers: config.headers
        });
        return config;
    },
    (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
    }
);

// Add response interceptor for better error handling
api.interceptors.response.use(
    (response) => {
        console.log('API Response:', {
            url: response.config.url,
            status: response.status,
            data: response.data
        });
        return response.data;
    },
    (error) => {
        console.error('API Error:', {
            url: error.config?.url,
            status: error.response?.status,
            data: error.response?.data,
            message: error.message
        });
        if (error.response?.status === 401) {
            // Handle unauthorized access
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Group Management APIs
export const groupApi = {
    getGroups: () => api.get('/users/groups'),
    createGroup: (groupData) => api.post('/users/groups', groupData),
    updateGroup: (id, groupData) => api.put(`/users/groups/${id}`, groupData),
    deleteGroup: (id) => api.delete(`/users/groups/${id}`),
    getGroupPermissions: (id) => api.get(`/users/groups/${id}/permissions`),
    updateGroupPermissions: (id, permissions) => api.put(`/users/groups/${id}/permissions`, permissions)
};

// Store Management APIs
export const storeApi = {
    getStores: () => api.get('/stores'),
    getStore: (id) => api.get(`/stores/${id}`),
    createStore: (data) => api.post('/stores', data),
    updateStore: (id, data) => api.put(`/stores/${id}`, data),
    deleteStore: (id) => api.delete(`/stores/${id}`),
    getStoreItems: (storeId) => api.get(`/stores/${storeId}/items`),
    deleteStoreItem: (storeId, itemId) => api.delete(`/stores/${storeId}/items/${itemId}`),
    exportStoreInventory: (storeId) => api.get(`/stores/${storeId}/export`, { responseType: 'blob' }),
    findItemStore: (serialNumber) => api.get(`/stores/find-item/${serialNumber}`)
};

// User Management APIs
export const userApi = {
    getUsers: () => api.get('/users'),
    createUser: (userData) => api.post('/users', userData),
    updateUser: (id, userData) => api.put(`/users/${id}`, userData),
    deleteUser: (id) => api.delete(`/users/${id}`)
};

// Authentication APIs
export const login = (credentials) => api.post('/users/login', credentials);
export const logout = () => api.post('/users/logout');
export const checkAuth = () => api.get('/users/check');

// Inventory Management APIs
export const getInventoryRecords = (params) => api.get('/records', { params });
export const getDuplicateRecords = () => api.get('/records/duplicates');
export const searchRecords = (searchTerm, params = {}) => {
    const queryParams = {
        ...params,
        q: searchTerm
    };
    return api.get('/records/search', { params: queryParams });
};
export const updateRecord = (id, data) => api.put(`/records/${id}`, data);
export const deleteRecord = (id) => api.delete(`/records/${id}`);
export const addRecord = (data) => api.post('/records', data);

// Outbound Management APIs
export const getOutboundItems = () => api.get('/outbound/items');
export const addToOutbound = (recordId) => api.post('/outbound/items', { recordId });
export const removeFromOutbound = (itemId) => api.delete(`/outbound/items/${itemId}`);
export const sendToStore = (storeId, itemIds, force = false) => 
    api.post(`/stores/${storeId}/outbound`, { itemIds, force });

// Location Management APIs
export const checkItemLocation = (serialNumber) => api.get(`/locations/${serialNumber}`);
export const checkItemLocations = (serialNumbers) => api.post('/locations/batch', { serialNumbers });
export const updateLocation = (serialNumber, data) => api.post(`/locations/${serialNumber}`, data);

export const salesApi = {
    // Get store sales
    getSales: async (storeId) => {
        try {
            const response = await api.get(`/sales/${storeId}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching sales:', error);
            throw error;
        }
    },

    // Add item to sales
    addToSales: async (storeId, data) => {
        try {
            const response = await api.post(`/sales/${storeId}`, data);
            return response.data;
        } catch (error) {
            console.error('Error adding to sales:', error);
            throw error;
        }
    },

    // Search sales by serial number
    searchSales: async (storeId, serialNumber) => {
        try {
            const response = await api.get(`/sales/${storeId}/search/${serialNumber}`);
            return response.data;
        } catch (error) {
            console.error('Error searching sales:', error);
            throw error;
        }
    }
};

export const rmaApi = {
    // Get store RMA items
    getRmaItems: async (storeId) => {
        try {
            return await api.get(`/rma/${storeId}`);
        } catch (error) {
            console.error('Error fetching RMA items:', error);
            throw error;
        }
    },

    // Add item to RMA
    addToRma: async (storeId, data) => {
        try {
            const response = await api.post(`/rma/${storeId}`, data);
            return response;
        } catch (error) {
            console.error('Error adding to RMA:', error);
            throw error;
        }
    },

    // Search RMA by serial number
    searchRma: async (storeId, serialNumber) => {
        try {
            const response = await api.get(`/rma/${storeId}/search/${serialNumber}`);
            return response.data;
        } catch (error) {
            console.error('Error searching RMA:', error);
            throw error;
        }
    },

    // Update RMA status
    updateRmaStatus: async (storeId, rmaId, status) => {
        try {
            const response = await api.put(`/rma/${storeId}/${rmaId}/status`, { status });
            return response.data;
        } catch (error) {
            console.error('Error updating RMA status:', error);
            throw error;
        }
    },

    // Update RMA fields
    updateRmaFields: async (storeId, rmaId, fields) => {
        try {
            const response = await api.put(`/rma/${storeId}/${rmaId}/fields`, fields);
            return response;
        } catch (error) {
            console.error('Error updating RMA fields:', error);
            throw error;
        }
    },

    // Delete RMA
    deleteRma: async (storeId, rmaId) => {
        try {
            const response = await api.delete(`/rma/${storeId}/${rmaId}`);
            return response;
        } catch (error) {
            console.error('Error deleting RMA:', error);
            throw error;
        }
    }
};

export const orderApi = {
    // Get store orders
    getOrders: async (storeId) => {
        try {
            const response = await api.get(`/orders/${storeId}`);
            return response;
        } catch (error) {
            console.error('Error fetching orders:', error);
            throw error;
        }
    },

    // Add items to order
    addToOrder: async (storeId, items) => {
        try {
            const response = await api.post(`/orders/${storeId}`, { items });
            return response;
        } catch (error) {
            console.error('Error adding to order:', error);
            throw error;
        }
    },

    // Save order (change status to completed)
    saveOrder: async (storeId, orderId) => {
        try {
            const response = await api.put(`/orders/${storeId}/${orderId}/save`);
            return response;
        } catch (error) {
            console.error('Error saving order:', error);
            throw error;
        }
    },

    // Delete order item
    deleteOrderItem: async (storeId, itemId) => {
        try {
            const response = await api.delete(`/orders/${storeId}/items/${itemId}`);
            return response;
        } catch (error) {
            console.error('Error deleting order item:', error);
            throw error;
        }
    },

    // Update order item notes
    updateOrderItemNotes: async (storeId, itemId, notes) => {
        try {
            const response = await api.put(`/orders/${storeId}/items/${itemId}/notes`, { notes });
            return response;
        } catch (error) {
            console.error('Error updating notes:', error);
            throw error;
        }
    },

    // Update order item price
    updateOrderItemPrice: async (storeId, itemId, price) => {
        try {
            const response = await api.put(`/orders/${storeId}/items/${itemId}/price`, { price });
            return response;
        } catch (error) {
            console.error('Error updating price:', error);
            throw error;
        }
    }
};

export default api; 