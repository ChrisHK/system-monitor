import { api } from '../config/axios';
import { ENDPOINTS } from '../config/endpoints';
import { withErrorHandling, createQueryString, downloadFile } from '../utils/apiUtils';

class StoreService {
  constructor() {
    // 綁定方法到實例
    this.getStores = this.getStores.bind(this);
    this.getStore = this.getStore.bind(this);
    this.createStore = this.createStore.bind(this);
    this.updateStore = this.updateStore.bind(this);
    this.deleteStore = this.deleteStore.bind(this);
    this.getStoreItems = this.getStoreItems.bind(this);
    this.addStoreItem = this.addStoreItem.bind(this);
    this.updateStoreItem = this.updateStoreItem.bind(this);
    this.deleteStoreItem = this.deleteStoreItem.bind(this);
    this.exportStoreInventory = this.exportStoreInventory.bind(this);
  }

  async getStores() {
    const response = await api.get(ENDPOINTS.STORE.LIST);
    return response;
  }

  async getStore(storeId) {
    const response = await api.get(ENDPOINTS.STORE.BY_ID(storeId));
    return response;
  }

  async createStore(storeData) {
    const response = await api.post(ENDPOINTS.STORE.CREATE, storeData);
    return response;
  }

  async updateStore(storeId, storeData) {
    const response = await api.put(ENDPOINTS.STORE.UPDATE(storeId), storeData);
    return response;
  }

  async deleteStore(storeId) {
    const response = await api.delete(ENDPOINTS.STORE.DELETE(storeId));
    return response;
  }

  async getStoreItems(storeId, params) {
    const response = await api.get(ENDPOINTS.STORE.ITEMS(storeId), { params });
    return response;
  }

  async addStoreItem(storeId, itemData) {
    const response = await api.post(ENDPOINTS.STORE.ADD_ITEM(storeId), itemData);
    return response;
  }

  async updateStoreItem(storeId, itemId, itemData) {
    const response = await api.put(ENDPOINTS.STORE.UPDATE_ITEM(storeId, itemId), itemData);
    return response;
  }

  async deleteStoreItem(storeId, itemId) {
    const response = await api.delete(ENDPOINTS.STORE.DELETE_ITEM(storeId, itemId));
    return response;
  }

  async exportStoreInventory(storeId, params) {
    const response = await api.get(ENDPOINTS.STORE.EXPORT(storeId), { params });
    return response;
  }

  async findItemStore(serialNumber) {
    const response = await api.get(ENDPOINTS.STORE.FIND_ITEM(serialNumber));
    return response;
  }

  async bulkAddItems(storeId, items) {
    const response = await api.post(
      `${ENDPOINTS.STORE.ITEMS(storeId)}/bulk`,
      { items }
    );
    return response;
  }

  async bulkUpdateItems(storeId, items) {
    const response = await api.put(
      `${ENDPOINTS.STORE.ITEMS(storeId)}/bulk`,
      { items }
    );
    return response;
  }

  async bulkDeleteItems(storeId, itemIds) {
    const response = await api.delete(
      `${ENDPOINTS.STORE.ITEMS(storeId)}/bulk`,
      { data: { itemIds } }
    );
    return response;
  }
}

// 創建服務實例
const storeService = new StoreService();

// 包裝所有方法
const wrappedService = {
  getStores: async () => {
    try {
      return await storeService.getStores();
    } catch (error) {
      console.error('Get stores error:', error);
      throw error;
    }
  },
  getStore: async (storeId) => {
    try {
      return await storeService.getStore(storeId);
    } catch (error) {
      console.error('Get store error:', error);
      throw error;
    }
  },
  createStore: async (storeData) => {
    try {
      return await storeService.createStore(storeData);
    } catch (error) {
      console.error('Create store error:', error);
      throw error;
    }
  },
  updateStore: async (storeId, storeData) => {
    try {
      return await storeService.updateStore(storeId, storeData);
    } catch (error) {
      console.error('Update store error:', error);
      throw error;
    }
  },
  deleteStore: async (storeId) => {
    try {
      return await storeService.deleteStore(storeId);
    } catch (error) {
      console.error('Delete store error:', error);
      throw error;
    }
  },
  getStoreItems: async (storeId, params) => {
    try {
      return await storeService.getStoreItems(storeId, params);
    } catch (error) {
      console.error('Get store items error:', error);
      throw error;
    }
  },
  addStoreItem: async (storeId, itemData) => {
    try {
      return await storeService.addStoreItem(storeId, itemData);
    } catch (error) {
      console.error('Add store item error:', error);
      throw error;
    }
  },
  updateStoreItem: async (storeId, itemId, itemData) => {
    try {
      return await storeService.updateStoreItem(storeId, itemId, itemData);
    } catch (error) {
      console.error('Update store item error:', error);
      throw error;
    }
  },
  deleteStoreItem: async (storeId, itemId) => {
    try {
      return await storeService.deleteStoreItem(storeId, itemId);
    } catch (error) {
      console.error('Delete store item error:', error);
      throw error;
    }
  },
  exportStoreInventory: async (storeId, params) => {
    try {
      return await storeService.exportStoreInventory(storeId, params);
    } catch (error) {
      console.error('Export store inventory error:', error);
      throw error;
    }
  }
};

export default wrappedService; 