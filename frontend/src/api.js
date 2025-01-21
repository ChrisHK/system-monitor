import axios from 'axios';

// Configure axios defaults
axios.defaults.baseURL = 'http://192.168.0.10:4000';

export const orderApi = {
    getOrders: async (storeId) => {
        try {
            const response = await axios.get(`/api/orders/${storeId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    addToOrder: async (storeId, items) => {
        try {
            const response = await axios.post(`/api/orders/${storeId}`, { items });
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    saveOrder: async (storeId, orderId) => {
        try {
            const response = await axios.put(`/api/orders/${storeId}/${orderId}/save`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    deleteOrderItem: async (storeId, itemId) => {
        try {
            const response = await axios.delete(`/api/orders/${storeId}/items/${itemId}`);
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    updateOrderItemNotes: async (storeId, itemId, notes) => {
        try {
            const response = await axios.put(`/api/orders/${storeId}/items/${itemId}/notes`, { notes });
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    updateOrderItemPrice: async (storeId, itemId, price) => {
        try {
            const response = await axios.put(`/api/orders/${storeId}/items/${itemId}/price`, { price });
            return response.data;
        } catch (error) {
            throw error.response?.data || error;
        }
    }
}; 