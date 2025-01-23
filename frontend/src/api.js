import axios from 'axios';
import api from './services/api';

export const rmaApi = {
    getInventoryRmaItems: async (page = 1, limit = 50) => {
        try {
            const response = await api.get('/inventory/rma', {
                params: { page, limit }
            });
            return response;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    processRma: async (rmaId) => {
        try {
            const response = await api.put(`/inventory/rma/${rmaId}/process`);
            return response;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    completeRma: async (rmaId) => {
        try {
            const response = await api.put(`/inventory/rma/${rmaId}/complete`);
            return response;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    failRma: async (rmaId, reason) => {
        try {
            const response = await api.put(`/inventory/rma/${rmaId}/fail`, { reason });
            return response;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    deleteInventoryRma: async (rmaId) => {
        try {
            const response = await api.delete(`/inventory/rma/${rmaId}`);
            return response;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    getRmaStats: async () => {
        try {
            const response = await api.get('/inventory/rma/stats');
            return response;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    exportToExcel: async (params) => {
        try {
            const response = await api.get('/inventory/rma/export', {
                params,
                responseType: 'blob'
            });
            return response;
        } catch (error) {
            throw error.response?.data || error;
        }
    }
};

export const orderApi = {
    getOrders: async (storeId) => {
        try {
            const response = await api.get(`/orders/${storeId}`);
            return response;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    addToOrder: async (storeId, items) => {
        try {
            const response = await api.post(`/orders/${storeId}`, { items });
            return response;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    saveOrder: async (storeId, orderId) => {
        try {
            const response = await api.put(`/orders/${storeId}/${orderId}/save`);
            return response;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    deleteOrderItem: async (storeId, itemId) => {
        try {
            const response = await api.delete(`/orders/${storeId}/items/${itemId}`);
            return response;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    updateOrderItemNotes: async (storeId, itemId, notes) => {
        try {
            const response = await api.put(`/orders/${storeId}/items/${itemId}/notes`, { notes });
            return response;
        } catch (error) {
            throw error.response?.data || error;
        }
    },

    updateOrderItemPrice: async (storeId, itemId, price) => {
        try {
            const response = await api.put(`/orders/${storeId}/items/${itemId}/price`, { price });
            return response;
        } catch (error) {
            throw error.response?.data || error;
        }
    }
}; 