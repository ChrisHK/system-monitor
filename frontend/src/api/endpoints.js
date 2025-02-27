export const ENDPOINTS = {
    ORDER: {
        STORE: {
            BASE: (storeId) => `/orders/${storeId}`,
            BY_ID: (storeId, orderId) => `/orders/${storeId}/${orderId}`,
            UPDATE_PRICE: (storeId, itemId) => `/orders/${storeId}/items/${itemId}/price`,
            UPDATE_PAY_METHOD: (storeId, itemId) => `/orders/${storeId}/items/${itemId}/pay-method`,
            UPDATE_NOTES: (storeId, itemId) => `/orders/${storeId}/items/${itemId}/notes`,
            DELETE_ITEM: (storeId, itemId) => `/orders/${storeId}/items/${itemId}`,
            SAVE: (storeId, orderId) => `/orders/${storeId}/${orderId}/save`,
            DELETE_COMPLETED: (storeId, orderId) => `/orders/${storeId}/completed/${orderId}`,
            SEARCH: (storeId, serialNumber) => `/orders/${storeId}/search/${serialNumber}`,
            EXPORT: (storeId) => `/orders/${storeId}/export`,
            ADD_TO_RMA: (storeId) => `/orders/${storeId}/rma`
        }
    },
    // ... existing code ...
} 