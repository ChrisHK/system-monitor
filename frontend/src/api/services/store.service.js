import api from '../index';
import { ENDPOINTS } from '../config/endpoints';
import { withErrorHandling, createQueryString, downloadFile } from '../utils/apiUtils';

class StoreService {
  constructor() {
    // Define all methods before binding
    this.getStores = async (params) => {
      try {
        console.log('Fetching stores with params:', params);
        const response = await api.get(ENDPOINTS.STORE.LIST, { params });
        
        if (!response?.success) {
          console.error('Store API returned unsuccessful response:', response);
          throw new Error(response?.error || 'Failed to fetch stores');
        }

        const stores = response.data?.stores || response.stores;
        if (!Array.isArray(stores)) {
          console.error('Invalid stores data format:', stores);
          throw new Error('Invalid stores data format');
        }

        console.log('Successfully fetched stores:', {
          count: stores.length,
          stores: stores.map(s => ({ id: s.id, name: s.name }))
        });

        return response;
      } catch (error) {
        console.error('Get stores error:', {
          error: error.message,
          stack: error.stack,
          params
        });
        throw error;
      }
    };

    this.searchStores = async (query) => {
      try {
        const response = await api.get(ENDPOINTS.STORE.SEARCH, {
          params: { q: query }
        });
        return response;
      } catch (error) {
        console.error('Search stores error:', error);
        throw error;
      }
    };

    this.getStoreById = async (storeId) => {
      try {
        const response = await api.get(ENDPOINTS.STORE.BY_ID(storeId));
        return response;
      } catch (error) {
        console.error('Get store by ID error:', error);
        throw error;
      }
    };

    this.createStore = async (storeData) => {
      try {
        const response = await api.post(ENDPOINTS.STORE.CREATE, storeData);
        return response;
      } catch (error) {
        console.error('Create store error:', error);
        throw error;
      }
    };

    this.updateStore = async (storeId, storeData) => {
      try {
        const response = await api.put(ENDPOINTS.STORE.BY_ID(storeId), storeData);
        return response;
      } catch (error) {
        console.error('Update store error:', error);
        throw error;
      }
    };

    this.deleteStore = async (storeId) => {
      try {
        const response = await api.delete(ENDPOINTS.STORE.BY_ID(storeId));
        return response;
      } catch (error) {
        console.error('Delete store error:', error);
        throw error;
      }
    };

    this.getStoreItems = async (storeId, params) => {
      try {
        const response = await api.get(ENDPOINTS.STORE.ITEMS(storeId), { 
          params: {
            ...params,
            exclude_ordered: params?.exclude_ordered || false
          }
        });
        
        if (!response?.success) {
          console.error('Store items API returned unsuccessful response:', response);
          throw new Error(response?.error || 'Failed to fetch store items');
        }

        return response;
      } catch (error) {
        console.error('Get store items error:', {
          error: error.message,
          stack: error.stack,
          storeId,
          params
        });
        throw error;
      }
    };

    this.addStoreItem = async (storeId, itemData) => {
      const response = await api.post(ENDPOINTS.STORE.ADD_ITEM(storeId), itemData);
      return response;
    };

    this.updateStoreItem = async (storeId, itemId, itemData) => {
      const response = await api.put(ENDPOINTS.STORE.UPDATE_ITEM(storeId, itemId), itemData);
      return response;
    };

    this.deleteStoreItem = async (storeId, itemId) => {
      const response = await api.delete(ENDPOINTS.STORE.DELETE_ITEM(storeId, itemId));
      return response;
    };

    this.exportStoreInventory = async (storeId, params) => {
      try {
        const response = await api.get(ENDPOINTS.STORE.EXPORT(storeId), { 
          params,
          responseType: 'blob'
        });
        const fileName = `store-${storeId}-inventory-${new Date().toISOString().split('T')[0]}.csv`;
        await downloadFile(response, fileName);
        return response;
      } catch (error) {
        console.error('Export store inventory error:', error);
        throw error;
      }
    };

    this.findItemStore = async (serialNumber) => {
      const response = await api.get(ENDPOINTS.STORE.FIND_ITEM(serialNumber));
      return response;
    };

    this.bulkAddItems = async (storeId, items) => {
      const response = await api.post(
        `${ENDPOINTS.STORE.ITEMS(storeId)}/bulk`,
        { items }
      );
      return response;
    };

    this.bulkUpdateItems = async (storeId, items) => {
      const response = await api.put(
        `${ENDPOINTS.STORE.ITEMS(storeId)}/bulk`,
        { items }
      );
      return response;
    };

    this.bulkDeleteItems = async (storeId, itemIds) => {
      const response = await api.delete(
        `${ENDPOINTS.STORE.ITEMS(storeId)}/bulk`,
        { data: { itemIds } }
      );
      return response;
    };

    this.getStoreInventory = async (storeId, params) => {
      try {
        const response = await api.get(ENDPOINTS.STORE.INVENTORY(storeId), { params });
        return response;
      } catch (error) {
        console.error('Get store inventory error:', error);
        throw error;
      }
    };

    this.getStoreReport = async (storeId, params) => {
      try {
        const response = await api.get(ENDPOINTS.REPORTS.STORE(storeId), { params });
        return response;
      } catch (error) {
        console.error('Get store report error:', error);
        throw error;
      }
    };

    this.exportStoreReport = async (storeId, params) => {
      try {
        const response = await api.get(ENDPOINTS.REPORTS.EXPORT.STORE(storeId), {
          params,
          responseType: 'blob'
        });
        return response;
      } catch (error) {
        console.error('Export store report error:', error);
        throw error;
      }
    };

    // Now bind all methods
    Object.getOwnPropertyNames(StoreService.prototype)
      .filter(prop => typeof this[prop] === 'function')
      .forEach(method => {
        this[method] = this[method].bind(this);
      });
  }
}

// Create service instance
const storeService = new StoreService();

// Export wrapped service
export default storeService; 