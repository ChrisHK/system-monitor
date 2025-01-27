import axios from 'axios';
import { createApiWrapper, validateRmaData, validateStatusTransition } from '../utils/errors';

const api = axios.create({
    baseURL: 'http://192.168.0.10:4000/api',
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
        
        console.log('API Request:', {
            url: config.url,
            method: config.method,
            headers: config.headers
        });
        
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
        console.log('API Response:', {
            url: response.config.url,
            status: response.status,
            success: response.data?.success
        });
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
        
        console.error('API Error:', {
            url: error.config?.url,
            status: error.response?.status,
            message: error.message,
            data: error.response?.data
        });

        // If it's a 400 error with a specific error message, return it as a response
        if (error.response?.status === 400 && error.response.data?.error) {
            return error.response.data;
        }

        return Promise.reject(error);
    }
);

// Group Management APIs
export const groupApi = {
    getGroups: () => api.get('/groups'),
    createGroup: (groupData) => api.post('/groups', groupData),
    updateGroup: (groupId, groupData) => api.put(`/groups/${groupId}`, groupData),
    deleteGroup: (groupId) => api.delete(`/groups/${groupId}`),
    getGroupPermissions: (groupId) => api.get(`/groups/${groupId}/permissions`),
    updateGroupPermissions: (groupId, permissions) => api.put(`/groups/${groupId}/permissions`, { permissions })
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
export const sendToStore = (storeId, outboundIds, force = false) => 
    api.post(`/stores/${storeId}/outbound`, { outboundIds, force });

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

// Add retry utility function
const fetchWithRetry = async (fn, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
    }
};

// Add error handling utility
const handleApiError = (error) => {
    console.error('API Error:', {
        url: error.config?.url,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
    });

    // If it's a network error
    if (!error.response) {
        throw new Error('Network error occurred. Please check your connection.');
    }

    // If it's a server error
    if (error.response.status >= 500) {
        throw new Error('Server error occurred. Please try again later.');
    }

    // If it's a client error
    if (error.response.data?.error) {
        throw new Error(error.response.data.error);
    }

    throw error;
};

export const rmaApi = {
    // Store RMA Operations
    getRmaItems: createApiWrapper(async (storeId) => {
        return await api.get(`/rma/${storeId}`);
    }),

    addToRma: createApiWrapper(async (storeId, data) => {
        validateRmaData(data);
        return await api.post(`/rma/${storeId}`, data);
    }),

    searchRma: createApiWrapper(async (storeId, serialNumber) => {
        return await api.get(`/rma/${storeId}/search/${serialNumber}`);
    }),

    sendToInventory: createApiWrapper(async (storeId, rmaId) => {
        const currentItem = await api.get(`/rma/${storeId}/${rmaId}`);
        if (!currentItem?.success || !currentItem.rma) {
            throw new Error('Failed to get RMA item');
        }
        validateStatusTransition(currentItem.rma.store_status, 'sent_to_inventory');
        return await api.put(`/rma/${storeId}/${rmaId}/send-to-inventory`);
    }),

    sendToStore: async (storeId, rmaId) => {
        try {
            const response = await api.put(`/rma/${storeId}/${rmaId}/send-to-store`);
            return response;
        } catch (error) {
            console.error('Error sending RMA item to store:', error);
            throw error;
        }
    },

    updateRmaFields: createApiWrapper(async (storeId, rmaId, fields) => {
        return await api.put(`/rma/${storeId}/${rmaId}/fields`, fields);
    }),

    deleteRma: createApiWrapper(async (storeId, rmaId) => {
        return await api.delete(`/rma/${storeId}/${rmaId}`);
    }),

    // Get RMA items with pagination
    getInventoryRmaItems: async (page = 1, limit = 50) => {
        try {
            const response = await api.get('/inventory/rma', {
                params: { page, limit }
            });
            console.log('Raw API response:', response);
            return response;  // Return response directly since interceptor already returns response.data
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    // Process an RMA item
    processRma: async (rmaId) => {
        try {
            const response = await fetchWithRetry(() => 
                api.put(`/inventory/rma/${rmaId}/process`)
            );
            return response;
        } catch (error) {
            throw handleApiError(error);
        }
    },

    // Complete an RMA item
    completeRma: async (rmaId) => {
        try {
            const response = await fetchWithRetry(() => 
                api.put(`/inventory/rma/${rmaId}/complete`)
            );
            return response;
        } catch (error) {
            throw handleApiError(error);
        }
    },

    // Fail an RMA item
    failRma: async (rmaId, reason) => {
        try {
            const response = await fetchWithRetry(() => 
                api.put(`/inventory/rma/${rmaId}/fail`, { reason })
            );
            return response;
        } catch (error) {
            throw handleApiError(error);
        }
    },

    // Delete an RMA item (admin only)
    deleteInventoryRma: async (rmaId) => {
        try {
            const response = await fetchWithRetry(() => 
                api.delete(`/inventory/rma/${rmaId}`)
            );
            return response;
        } catch (error) {
            throw handleApiError(error);
        }
    },

    // Get RMA statistics
    getRmaStats: async () => {
        try {
            const response = await fetchWithRetry(() => 
                api.get('/inventory/rma/stats')
            );
            return response;
        } catch (error) {
            throw handleApiError(error);
        }
    },

    // Export RMA data to Excel
    exportToExcel: async (params) => {
        try {
            const response = await fetchWithRetry(() => 
                api.get('/inventory/rma/export', {
                    params,
                    responseType: 'blob'
                })
            );
            return response;
        } catch (error) {
            throw handleApiError(error);
        }
    },

    // Batch Operations
    batchProcess: createApiWrapper(async (rmaIds) => {
        return await api.put('/inventory/rma/batch-process', { rmaIds });
    }),

    batchComplete: createApiWrapper(async (rmaIds) => {
        return await api.put('/inventory/rma/batch-complete', { rmaIds });
    }),

    batchFail: createApiWrapper(async (rmaIds, reason) => {
        return await api.put('/inventory/rma/batch-fail', { rmaIds, failed_reason: reason });
    }),

    updateInventoryRma: async (rmaId, data) => {
        try {
            const response = await api.put(`/inventory/rma/${rmaId}`, data);
            return response;
        } catch (error) {
            throw error.response?.data || error;
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
    },

    // Update order item payment method
    updateOrderItemPayMethod: async (storeId, itemId, payMethod) => {
        try {
            const response = await api.put(`/orders/${storeId}/items/${itemId}/pay-method`, { pay_method: payMethod });
            return response;
        } catch (error) {
            console.error('Error updating payment method:', error);
            throw error;
        }
    },

    // Export completed orders as CSV
    exportOrders: async (storeId, startDate, endDate) => {
        try {
            const response = await api.get(`/orders/${storeId}/export`, {
                params: { startDate, endDate },
                responseType: 'blob'
            });
            
            // Create a download link
            const url = window.URL.createObjectURL(new Blob([response]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `orders_${startDate.split('T')[0]}_${endDate.split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            
            return { success: true };
        } catch (error) {
            console.error('Error exporting orders:', error);
            throw error;
        }
    },

    // Add deleteOrder method
    deleteOrder: async (storeId, orderId) => {
        try {
            const response = await api.delete(`/orders/${storeId}/completed/${orderId}`);
            return response;
        } catch (error) {
            console.error('Error deleting order:', error);
            throw error;
        }
    }
};

export default api; 