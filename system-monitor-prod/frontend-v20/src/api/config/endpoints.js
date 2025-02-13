export const getApiBaseUrl = () => {
  return process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
};

export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/users/login',
    LOGOUT: '/users/logout',
    CHECK: '/users/me',
  },
  USER: {
    BASE: '/users',
    LIST: '/users',
    CURRENT: '/users/me',
    CREATE: '/users',
    UPDATE: (id) => `/users/${id}`,
    DELETE: (id) => `/users/${id}`,
  },
  GROUP: {
    LIST: '/groups',
    CREATE: '/groups',
    BY_ID: (id) => `/groups/${id}`,
    UPDATE: (id) => `/groups/${id}`,
    DELETE: (id) => `/groups/${id}`,
    PERMISSIONS: {
      UPDATE: (id) => `/groups/${id}/permissions`,
      STORE: (id, storeId) => `/groups/${id}/stores/${storeId}/permissions`
    }
  },
  INVENTORY: {
    BASE: '/records',
    SEARCH: '/records/search',
    DUPLICATES: '/records/duplicates',
    BY_ID: (id) => `/records/${id}`,
    CHECK_LOCATION: (serialNumber) => `/records/check-location/${serialNumber}`,
    CLEANUP_DUPLICATES: '/records/cleanup-duplicates',
    WITH_LOCATIONS: '/records/with-locations',
  },
  OUTBOUND: {
    ITEMS: '/outbound/items',
    ADD_ITEM: '/outbound/items',
    REMOVE_ITEM: (id) => `/outbound/items/${id}`,
    SEND_TO_STORE: (storeId) => `/stores/${storeId}/outbound`,
    CONFIRM: (id) => `/outbound/${id}/confirm`,
    SEARCH: '/outbound/search'
  },
  STORE: {
    BASE: '/stores',
    LIST: '/stores',
    CREATE: '/stores',
    BY_ID: (id) => `/stores/${id}`,
    UPDATE: (id) => `/stores/${id}`,
    DELETE: (id) => `/stores/${id}`,
    ITEMS: (storeId) => `/stores/${storeId}/items`,
    ADD_ITEM: (storeId) => `/stores/${storeId}/items`,
    UPDATE_ITEM: (storeId, itemId) => `/stores/${storeId}/items/${itemId}`,
    DELETE_ITEM: (storeId, itemId) => `/stores/${storeId}/items/${itemId}`,
    EXPORT: (storeId) => `/stores/${storeId}/export`,
    FIND_ITEM: (serialNumber) => `/stores/find-item/${serialNumber}`,
    CHECK_ITEMS: (storeId) => `/stores/${storeId}/check-items`,
    CHECK: (storeId) => `/stores/${storeId}/check`,
    ITEMS_WITH_LOCATIONS: (storeId) => `/stores/${storeId}/items-with-locations`,
  },
  RMA: {
    STORE: {
      BASE: (storeId) => `/rma/${storeId}`,
      SEARCH: (storeId, serialNumber) => `/rma/${storeId}/search/${serialNumber}`,
      BY_ID: (storeId, rmaId) => `/rma/${storeId}/${rmaId}`,
      SEND_TO_INVENTORY: (storeId, rmaId) => `/rma/${storeId}/${rmaId}/send-to-inventory`,
      SEND_TO_STORE: (storeId, rmaId) => `/rma/${storeId}/${rmaId}/send-to-store`,
      UPDATE_FIELDS: (storeId, rmaId) => `/rma/${storeId}/${rmaId}/fields`,
      UPDATE_STATUS: (storeId, rmaId) => `/rma/${storeId}/${rmaId}/status`,
    },
    INVENTORY: {
      BASE: '/inventory/rma',
      SEARCH: (serialNumber) => `/inventory/rma/search/${serialNumber}`,
      BY_ID: (rmaId) => `/inventory/rma/${rmaId}`,
      UPDATE: (rmaId) => `/inventory/rma/${rmaId}`,
      PROCESS: (rmaId) => `/inventory/rma/${rmaId}/process`,
      COMPLETE: (rmaId) => `/inventory/rma/${rmaId}/complete`,
      FAIL: (rmaId) => `/inventory/rma/${rmaId}/fail`,
      DELETE: (rmaId) => `/inventory/rma/${rmaId}`,
      EXPORT: '/inventory/rma/export',
      STATS: '/inventory/rma/stats'
    }
  },
  ORDER: {
    BASE: '/orders',
    BY_ID: (id) => `/orders/${id}`,
    STORE: {
      BASE: (storeId) => `/orders/${storeId}`,
      BY_ID: (storeId, orderId) => `/orders/${storeId}/${orderId}`,
      SAVE: (storeId, orderId) => `/orders/${storeId}/${orderId}/save`,
      DELETE_ITEM: (storeId, itemId) => `/orders/${storeId}/items/${itemId}`,
      UPDATE_NOTES: (storeId, itemId) => `/orders/${storeId}/items/${itemId}/notes`,
      UPDATE_PRICE: (storeId, itemId) => `/orders/${storeId}/items/${itemId}/price`,
      DELETE_COMPLETED: (storeId, orderId) => `/orders/${storeId}/completed/${orderId}`,
    },
    PURCHASE: {
      BASE: '/purchase-orders',
      BY_ID: (id) => `/purchase-orders/${id}`,
      FORMATS: {
        LIST: '/purchase-orders/formats/list',
        CREATE: '/purchase-orders/formats',
        UPDATE: (id) => `/purchase-orders/formats/${id}`,
        DELETE: (id) => `/purchase-orders/formats/${id}`,
      },
      TEMPLATE: {
        DOWNLOAD: '/purchase-orders/template/download',
        IMPORT: '/purchase-orders/import',
      }
    }
  },
  SALES: {
    BASE: (storeId) => `/sales/${storeId}`,
    SEARCH: (storeId, serialNumber) => `/sales/${storeId}/search/${serialNumber}`,
  },
  LOCATION: {
    CHECK: (serialNumber) => `/location/${serialNumber}`,
    UPDATE: (serialNumber) => `/location/${serialNumber}`,
    BATCH: '/location/batch',
  }
}; 