import { api } from '../config/axios';
import { ENDPOINTS } from '../config/endpoints';
import { withErrorHandling, createQueryString, downloadFile } from '../utils/apiUtils';

class InventoryService {
  constructor() {
    // 綁定方法到實例
    this.getInventoryRecords = this.getInventoryRecords.bind(this);
    this.searchRecords = this.searchRecords.bind(this);
    this.getDuplicateRecords = this.getDuplicateRecords.bind(this);
    this.checkItemLocation = this.checkItemLocation.bind(this);
    this.addToOutbound = this.addToOutbound.bind(this);
    this.removeFromOutbound = this.removeFromOutbound.bind(this);
    this.getOutboundItems = this.getOutboundItems.bind(this);
    this.sendToStore = this.sendToStore.bind(this);
    this.updateRecord = this.updateRecord.bind(this);
    this.deleteRecord = this.deleteRecord.bind(this);
    this.addToOutboundBySerial = this.addToOutboundBySerial.bind(this);
    this.sendToStoreBulk = this.sendToStoreBulk.bind(this);
  }

  async getInventoryRecords(params) {
    const response = await api.get(ENDPOINTS.INVENTORY.BASE, { params });
    return response;
  }

  async searchRecords(field, term, params = {}) {
    const searchParams = {
      ...params,
      q: term
    };
    const response = await api.get(ENDPOINTS.INVENTORY.SEARCH, { params: searchParams });
    return response;
  }

  async getDuplicateRecords() {
    const response = await api.get(ENDPOINTS.INVENTORY.DUPLICATES);
    return response;
  }

  async checkItemLocation(serialNumber) {
    const response = await api.get(ENDPOINTS.INVENTORY.CHECK_LOCATION(serialNumber));
    console.log('Check location response:', response);
    
    if (response?.success) {
      // 如果在商店中
      if (response.location === 'store') {
        return {
          success: true,
          location: 'store',
          store: {
            name: response.storeName,
            id: response.storeId
          }
        };
      }
      // 如果在 outbound 中
      if (response.location === 'outbound') {
        return {
          success: true,
          location: 'outbound'
        };
      }
      // 如果在 inventory 中
      if (response.location === 'inventory') {
        return {
          success: true,
          location: 'inventory'
        };
      }
      // 如果沒有位置信息
      return {
        success: true,
        location: 'inventory'
      };
    }
    return response;
  }

  async addToOutboundBySerial(serialNumber) {
    if (!serialNumber) {
      throw new Error('Serial number is required');
    }
    const searchResponse = await this.searchRecords('serialnumber', serialNumber);
    if (!searchResponse?.success || !searchResponse.records?.length) {
      throw new Error('Record not found');
    }
    const record = searchResponse.records[0];
    return this.addToOutbound(record.id);
  }

  async addToOutbound(recordId) {
    const response = await api.post(ENDPOINTS.OUTBOUND.ADD_ITEM, { recordId });
    return response;
  }

  async removeFromOutbound(itemId) {
    const response = await api.delete(ENDPOINTS.OUTBOUND.REMOVE_ITEM(itemId));
    return response;
  }

  async getOutboundItems() {
    const response = await api.get(ENDPOINTS.OUTBOUND.ITEMS);
    return response;
  }

  async sendToStore(storeId) {
    if (!storeId) {
      throw new Error('Store ID is required');
    }
    const outboundItems = await this.getOutboundItems();
    if (!outboundItems?.success || !outboundItems.items?.length) {
      throw new Error('No outbound items to send');
    }
    const outboundIds = outboundItems.items.map(item => item.outbound_item_id);
    const response = await api.post(ENDPOINTS.OUTBOUND.SEND_TO_STORE(storeId), {
      outboundIds,
      force: false
    });
    return response;
  }

  async sendToStoreBulk(storeId) {
    if (!storeId) {
      throw new Error('Store ID is required');
    }
    const outboundItems = await this.getOutboundItems();
    if (!outboundItems?.success || !outboundItems.items?.length) {
      throw new Error('No outbound items to send');
    }
    const outboundIds = outboundItems.items.map(item => item.outbound_item_id);
    const response = await api.post(ENDPOINTS.OUTBOUND.SEND_TO_STORE(storeId), {
      outboundIds,
      force: false
    });
    return response;
  }

  async updateRecord(recordId, data) {
    const response = await api.put(ENDPOINTS.INVENTORY.UPDATE(recordId), data);
    return response;
  }

  async deleteRecord(recordId) {
    const response = await api.delete(ENDPOINTS.INVENTORY.DELETE(recordId));
    return response;
  }

  async getRecordById(id) {
    const response = await api.get(ENDPOINTS.INVENTORY.BY_ID(id));
    return response;
  }

  async createRecord(recordData) {
    const response = await api.post(ENDPOINTS.INVENTORY.BASE, recordData);
    return response;
  }

  async bulkUpdateRecords(records) {
    const response = await api.put(`${ENDPOINTS.INVENTORY.BASE}/bulk`, { records });
    return response;
  }

  async bulkDeleteRecords(ids) {
    const response = await api.delete(`${ENDPOINTS.INVENTORY.BASE}/bulk`, {
      data: { ids }
    });
    return response;
  }

  async exportInventory(params) {
    const response = await api.get(
      `${ENDPOINTS.INVENTORY.BASE}/export${createQueryString(params)}`,
      { responseType: 'blob' }
    );
    await downloadFile(response, 'inventory-export.xlsx');
    return response;
  }

  async importInventory(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post(
      `${ENDPOINTS.INVENTORY.BASE}/import`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );
    return response;
  }
}

// 創建服務實例
const inventoryService = new InventoryService();

// 包裝所有方法
const wrappedService = {
  getInventoryRecords: async (params) => {
    try {
      return await inventoryService.getInventoryRecords(params);
    } catch (error) {
      console.error('Get inventory records error:', error);
      throw error;
    }
  },
  searchRecords: async (field, term, params) => {
    try {
      return await inventoryService.searchRecords(field, term, params);
    } catch (error) {
      console.error('Search records error:', error);
      throw error;
    }
  },
  getDuplicateRecords: async () => {
    try {
      return await inventoryService.getDuplicateRecords();
    } catch (error) {
      console.error('Get duplicate records error:', error);
      throw error;
    }
  },
  checkItemLocation: async (serialNumber) => {
    try {
      return await inventoryService.checkItemLocation(serialNumber);
    } catch (error) {
      console.error('Check item location error:', error);
      throw error;
    }
  },
  addToOutbound: async (recordId) => {
    try {
      return await inventoryService.addToOutbound(recordId);
    } catch (error) {
      console.error('Add to outbound error:', error);
      throw error;
    }
  },
  removeFromOutbound: async (itemId) => {
    try {
      return await inventoryService.removeFromOutbound(itemId);
    } catch (error) {
      console.error('Remove from outbound error:', error);
      throw error;
    }
  },
  getOutboundItems: async () => {
    try {
      return await inventoryService.getOutboundItems();
    } catch (error) {
      console.error('Get outbound items error:', error);
      throw error;
    }
  },
  sendToStore: async (storeId) => {
    try {
      return await inventoryService.sendToStore(storeId);
    } catch (error) {
      console.error('Send to store error:', error);
      throw error;
    }
  },
  updateRecord: async (recordId, data) => {
    try {
      return await inventoryService.updateRecord(recordId, data);
    } catch (error) {
      console.error('Update record error:', error);
      throw error;
    }
  },
  deleteRecord: async (recordId) => {
    try {
      return await inventoryService.deleteRecord(recordId);
    } catch (error) {
      console.error('Delete record error:', error);
      throw error;
    }
  },
  addToOutboundBySerial: async (serialNumber) => {
    try {
      return await inventoryService.addToOutboundBySerial(serialNumber);
    } catch (error) {
      console.error('Add to outbound by serial error:', error);
      throw error;
    }
  },
  sendToStoreBulk: async (storeId) => {
    try {
      return await inventoryService.sendToStoreBulk(storeId);
    } catch (error) {
      console.error('Send to store bulk error:', error);
      throw error;
    }
  }
};

export default wrappedService; 