// Get store by ID
export const getStore = async (storeId) => {
    try {
        const response = await api.get(`/stores/${storeId}`);
        return response.data;
    } catch (error) {
        console.error('Error getting store:', error);
        throw error;
    }
};

// Get store items
export const getStoreItems = async (storeId) => {
    try {
        const response = await api.get(`/stores/${storeId}/items`);
        return response.data;
    } catch (error) {
        console.error('Error getting store items:', error);
        throw error;
    }
}; 