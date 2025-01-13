import axios from 'axios';

// API Base URL
const API_BASE_URL = 'http://192.168.0.10:4000/api';

// Configure axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Log all environment variables and connection info for debugging
console.log('API Configuration:', {
    baseURL: API_BASE_URL,
    origin: window.location.origin
});

// Token refresh promise
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Request interceptor for adding auth token and logging
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        
        // Log request details for debugging
        console.log('API Request:', {
            url: config.url,
            fullUrl: `${config.baseURL}${config.url}`,
            method: config.method,
            hasToken: !!token,
            params: config.params
        });

        // Add auth token if available
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor for handling auth errors
api.interceptors.response.use(
    (response) => {
        // Clear redirect flag on successful response
        window.isRedirecting = false;
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                try {
                    const token = await new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    });
                    originalRequest.headers['Authorization'] = `Bearer ${token}`;
                    return api(originalRequest);
                } catch (err) {
                    return Promise.reject(err);
                }
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    throw new Error('No refresh token available');
                }

                const response = await api.post('/users/refresh-token');
                if (response?.data?.token) {
                    const newToken = response.data.token;
                    localStorage.setItem('token', newToken);
                    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
                    originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                    
                    processQueue(null, newToken);
                    return api(originalRequest);
                } else {
                    throw new Error('Failed to refresh token');
                }
            } catch (refreshError) {
                processQueue(refreshError, null);
                // Only redirect if not on login page and not already redirecting
                const isOnLoginPage = window.location.pathname.includes('/login');
                if (!isOnLoginPage && !window.isRedirecting) {
                    window.isRedirecting = true;
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.replace('/login');
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }
        return Promise.reject(error);
    }
);

// API request helpers with automatic error handling
const handleApiResponse = async (promise) => {
    try {
        console.log('Making API request...');
        const response = await promise;
        console.log('API response:', response);

        // Check if response exists
        if (!response) {
            console.error('No response received from API');
            return {
                success: false,
                error: 'No response received from API'
            };
        }

        // Check if response has data
        if (!response.data) {
            console.error('No data in API response');
            return {
                success: false,
                error: 'No data in API response'
            };
        }

        // If response.data already has success field, return it
        if (typeof response.data.success !== 'undefined') {
            return response.data;
        }

        // Otherwise, wrap the data in a success response
        return {
            success: true,
            ...response.data
        };
    } catch (error) {
        console.error('API Error:', error);
        console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
            config: error.config
        });

        // Handle network errors
        if (!error.response) {
            return {
                success: false,
                error: 'Network error - please check your connection'
            };
        }

        // Handle timeout errors
        if (error.code === 'ECONNABORTED') {
            return {
                success: false,
                error: 'Request timed out - please try again'
            };
        }

        // Handle API errors
        return {
            success: false,
            error: error.response?.data?.error || error.message || 'An unknown error occurred'
        };
    }
};

// Inventory Management with improved error handling
export const getInventoryRecords = async (params) => {
    const response = await handleApiResponse(api.get('/records', { params }));
    
    // Ensure we return a consistent format
    if (response?.success) {
        return {
            success: true,
            records: response.records || []
        };
    }
    
    return {
        success: false,
        error: response?.error || 'Failed to fetch records',
        records: []
    };
};

export const getDuplicateRecords = () => 
    handleApiResponse(api.get('/records/duplicates'));

export const searchRecords = (query) => 
    handleApiResponse(api.get(`/records/search?q=${query}`));

export const updateRecord = (id, data) => 
    handleApiResponse(api.put(`/records/${id}`, data));

export const deleteRecord = (id) => 
    handleApiResponse(api.delete(`/records/${id}`));

export const addRecord = (data) => 
    handleApiResponse(api.post('/records', data));

export const importRecords = (formData) => 
    handleApiResponse(api.post('/records/import', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }));

export const exportRecords = (params) => api.get('/records/export', { 
    params,
    responseType: 'blob' 
});

// Store Management
export const storeApi = {
    getStores: () => handleApiResponse(api.get('/stores')),
    getStore: (id) => {
        console.log(`Making API request to get store ${id}`);
        return handleApiResponse(api.get(`/stores/${id}/items`));
    },
    createStore: (data) => handleApiResponse(api.post('/stores', data)),
    updateStore: (id, data) => handleApiResponse(api.put(`/stores/${id}`, data)),
    deleteStore: (id) => handleApiResponse(api.delete(`/stores/${id}`)),
    getStoreItems: (storeId) => {
        console.log(`Making API request to get items for store ${storeId}`);
        console.log('API Base URL:', API_BASE_URL);
        return handleApiResponse(api.get(`/stores/${storeId}/items`));
    },
    deleteStoreItem: (storeId, itemId) => {
        console.log(`Making API request to delete item ${itemId} from store ${storeId}`);
        return handleApiResponse(api.delete(`/stores/${storeId}/items/${itemId}`));
    },
    exportStoreInventory: (storeId) => {
        console.log(`Making API request to export inventory for store ${storeId}`);
        return handleApiResponse(api.get(`/stores/${storeId}/export`, { responseType: 'blob' }));
    },
    findItemStore: async (serialNumber) => {
        try {
            const response = await handleApiResponse(api.get(`/stores/find-item/${serialNumber}`));
            return {
                success: true,
                store: response.store
            };
        } catch (error) {
            console.error('Error finding item store:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};

// Store Items Management with locations
export const getStoreItems = (storeId) => 
    handleApiResponse(api.get(`/stores/${storeId}/items-with-locations`)).then(response => {
        if (!response?.success) {
            throw new Error('Failed to fetch store items');
        }
        
        // Transform and validate items for this specific store
        const items = (response.items || []).map(item => ({
            ...item,
            key: item.id || item.serialnumber,
            received_at: item.received_at || new Date().toISOString(),
            store_id: storeId, // Ensure store_id is set
            location: item.location || 'unknown',
            storeName: item.store_name
        }));

        return {
            success: true,
            items: items
        };
    });

export const checkStoreItem = (storeId, serialNumber) => 
    handleApiResponse(api.get(`/stores/${storeId}/items/${serialNumber}`));

export const addStoreItem = (storeId, data) => 
    handleApiResponse(api.post(`/stores/${storeId}/items`, data));

export const removeStoreItem = (storeId, serialNumber) => 
    handleApiResponse(api.delete(`/stores/${storeId}/items/${serialNumber}`));

// Outbound Management
export const getOutboundItems = () => 
    handleApiResponse(api.get('/outbound/items')).then(response => ({
        success: true,
        items: response.items || []
    }));

export const addToOutbound = (recordId) => 
    handleApiResponse(api.post('/outbound/items', { recordId })).then(response => ({
        success: true,
        item: response.item
    }));

export const removeFromOutbound = (itemId) => 
    handleApiResponse(api.delete(`/outbound/items/${itemId}`)).then(response => ({
        success: true,
        message: response.message || 'Item removed successfully'
    }));

export const checkItemLocation = async (serialNumber) => {
    try {
        const response = await locationApi.getLocation(serialNumber);
        if (response.success) {
            return response.location;
        }
        
        // If no location found, check if it's in any store
        const storeResponse = await storeApi.findItemStore(serialNumber);
        if (storeResponse.success && storeResponse.store) {
            const locationData = {
                location: 'store',
                storeId: storeResponse.store.id,
                storeName: storeResponse.store.name
            };
            
            // Update location in database
            await locationApi.updateLocation(serialNumber, locationData);
            return locationData;
        }
        
        // If not in any store, it must be in inventory
        const inventoryLocation = {
            location: 'inventory'
        };
        await locationApi.updateLocation(serialNumber, inventoryLocation);
        return inventoryLocation;
    } catch (error) {
        console.error('Error checking item location:', error);
        return { location: 'unknown' };
    }
};

// User Management APIs
export const getUsers = () => {
    return api.get('/users');
};

export const createUser = (userData) => {
    return api.post('/users', userData);
};

export const updateUser = (userId, userData) => {
    return api.put(`/users/${userId}`, userData);
};

export const deleteUser = (userId) => {
    return api.delete(`/users/${userId}`);
};

// Authentication APIs with specific error handling
export const login = async (credentials) => {
    try {
        // Log the request for debugging
        console.log('Login Request:', {
            url: `${API_BASE_URL}/users/login`,
            credentials: { ...credentials, password: '[REDACTED]' }
        });

        const response = await api.post('/users/login', credentials);
        
        // Log response for debugging
        console.log('Login Response:', {
            status: response?.status,
            data: response?.data,
            success: response?.data?.success
        });

        // Handle successful login
        if (response?.data?.token && response?.data?.user) {
            const { token, user } = response.data;
            
            // Set token in axios headers first
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            // Store credentials immediately after successful login
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));

            return {
                success: true,
                token,
                user
            };
        }

        // Handle failed login
        return {
            success: false,
            error: response?.data?.message || 'Invalid login response'
        };
    } catch (error) {
        console.error('Login Error:', error);
        // Provide more detailed error information
        return {
            success: false,
            error: error.response?.data?.message || error.message || 'Login failed',
            details: {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data
            }
        };
    }
};

export const logout = async () => {
    try {
        await api.post('/users/logout');
    } catch (error) {
        console.error('Logout Error:', error);
    } finally {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }
};

export const checkAuth = async () => {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            return {
                success: false,
                error: 'No token found'
            };
        }

        const response = await api.get('/users/check');
        
        if (response?.data?.user) {
            return {
                success: true,
                user: response.data.user
            };
        }

        return {
            success: false,
            error: response?.data?.message || 'Auth check failed'
        };
    } catch (error) {
        console.error('Auth Check Error:', error);
        return {
            success: false,
            error: error.response?.data?.message || error.message || 'Authentication failed'
        };
    }
};

// Store Management with improved error handling
export const createStore = (storeData) => 
    handleApiResponse(api.post('/stores', storeData));

export const checkStoreItems = (storeId, items) => 
    handleApiResponse(api.post(`/stores/${storeId}/check-items`, { items }));

export const sendToStore = async (storeId, itemIds, force = false) => {
    try {
        console.log('Sending items to store:', { storeId, itemIds, force });
        const response = await api.post(`/stores/${storeId}/outbound`, { itemIds, force });
        console.log('Send to store response:', response);

        if (response?.data?.success) {
            return {
                success: true,
                message: response.data.message || 'Items sent to store successfully'
            };
        }

        return {
            success: false,
            error: response.data?.error || 'Failed to send items to store'
        };
    } catch (error) {
        console.error('Error sending items to store:', error);
        return {
            success: false,
            error: error.response?.data?.error || error.message || 'Failed to send items to store'
        };
    }
};

export const getRecordsWithLocations = async (params) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/records/with-locations`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching records with locations:', error);
    throw error;
  }
};

// Location API methods
export const locationApi = {
    updateLocation: async (serialNumber, locationData) => {
        return handleApiResponse(api.post(`/locations/${serialNumber}`, locationData));
    },
    
    getLocation: async (serialNumber) => {
        return handleApiResponse(api.get(`/locations/${serialNumber}`));
    },
    
    getLocations: async (serialNumbers) => {
        return handleApiResponse(api.post('/locations/batch', { serialNumbers }));
    },

    deleteLocation: async (serialNumber) => {
        return handleApiResponse(api.delete(`/locations/${serialNumber}`));
    }
};

// Export the api instance
export default api; 