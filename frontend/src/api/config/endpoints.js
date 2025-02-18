export const getApiBaseUrl = () => {
  const currentHostname = window.location.hostname;
  const nodeEnv = process.env.NODE_ENV;
  const protocol = window.location.protocol;
  const host = window.location.host;

  // Log all relevant environment variables and settings
  console.log('API Configuration:', {
    currentHostname,
    nodeEnv,
    protocol,
    host,
    REACT_APP_API_URL: process.env.REACT_APP_API_URL,
    timestamp: new Date().toISOString()
  });

  // Production environment - always use relative path, ignore environment variables
  if (nodeEnv === 'production') {
    const baseUrl = '/api';
    console.log('Using production API URL (ignoring env vars):', {
      baseUrl,
      fullUrl: `${protocol}//${host}${baseUrl}`,
      envUrl: process.env.REACT_APP_API_URL,
      message: 'Environment variable ignored in production',
      timestamp: new Date().toISOString()
    });
    return baseUrl;
  }

  // Development environment
  if (nodeEnv === 'development') {
    // 優先使用環境變量中的 URL
    const devUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
    console.log('Using development API URL:', {
      url: devUrl,
      source: process.env.REACT_APP_API_URL ? 'env' : 'default',
      timestamp: new Date().toISOString()
    });
    return devUrl;
  }

  // Fallback - use relative path
  const fallbackUrl = '/api';
  console.log('Using fallback API URL:', {
    url: fallbackUrl,
    timestamp: new Date().toISOString()
  });
  return fallbackUrl;
};

export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/users/login',
    LOGOUT: '/users/logout',
    REFRESH_TOKEN: '/users/refresh',
    VALIDATE_TOKEN: '/users/validate',
    UPDATE_PASSWORD: '/users/password/update',
    REQUEST_PASSWORD_RESET: '/users/password/reset/request',
    RESET_PASSWORD: '/users/password/reset',
    CHECK: '/users/me'
  },
  USER: {
    CURRENT: '/users/me',
    LIST: '/users',
    CREATE: '/users',
    BY_ID: (id) => `/users/${id}`,
    UPDATE_PROFILE: '/users/profile',
    ROLES: '/users/roles',
    UPDATE_ROLE: (userId) => `/users/${userId}/role`,
    PERMISSIONS: '/users/permissions',
    UPDATE_PERMISSIONS: (userId) => `/users/${userId}/permissions`
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
    WITH_LOCATIONS: '/records/with-locations'
  },
  OUTBOUND: {
    ITEMS: '/outbound/items',
    ADD_ITEM: '/outbound/items',
    REMOVE_ITEM: (itemId) => `/outbound/items/${itemId}`,
    SEND_TO_STORE: (storeId) => `/outbound/send/${storeId}`,
    CONFIRM: (id) => `/outbound/${id}/confirm`,
    SEARCH: '/outbound/search'
  },
  STORE: {
    LIST: '/stores',
    CREATE: '/stores',
    BY_ID: (id) => `/stores/${id}`,
    INVENTORY: (storeId) => `/stores/${storeId}/inventory`,
    SEARCH: '/stores/search',
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
    CHECK: (serialNumber) => `/records/check-location/${serialNumber}`,
    UPDATE: (serialNumber) => `/records/update-location/${serialNumber}`,
    BATCH: '/records/batch-location-update'
  },
  REPORTS: {
    INVENTORY: '/reports/inventory',
    OUTBOUND: '/reports/outbound',
    STORE: (storeId) => `/reports/store/${storeId}`,
    EXPORT: {
      INVENTORY: '/reports/export/inventory',
      STORE: (storeId) => `/reports/export/store/${storeId}`
    }
  },
  TAGS: {
    LIST: '/tags',
    CREATE: '/tags',
    BY_ID: (id) => `/tags/${id}`,
    UPDATE: (id) => `/tags/${id}`,
    DELETE: (id) => `/tags/${id}`,
    CATEGORIES: {
      LIST: '/tags/categories',
      CREATE: '/tags/categories',
      BY_ID: (id) => `/tags/categories/${id}`,
      UPDATE: (id) => `/tags/categories/${id}`,
      DELETE: (id) => `/tags/categories/${id}`
    },
    ASSIGN: {
      ADD: (recordId) => `/tags/${recordId}/assign`,
      REMOVE: (recordId, tagId) => `/tags/${recordId}/remove/${tagId}`,
      BATCH: '/tags/batch-assign'
    }
  }
}; 