import api from '../index';
import { ENDPOINTS } from '../config/endpoints';
import { withErrorHandling, createQueryString, downloadFile } from '../utils/apiUtils';

class InventoryService {
  constructor() {
    // Define all methods first
    this.getInventoryRecords = async (params) => {
      try {
        console.log('Fetching inventory records with params:', {
          params,
          timestamp: new Date().toISOString()
        });
        const response = await api.get(ENDPOINTS.INVENTORY.BASE, { params });
        console.log('Inventory records response:', {
          success: response.success,
          total: response.total,
          recordsCount: response.records?.length,
          timestamp: new Date().toISOString()
        });
        return response;
      } catch (error) {
        console.error('Get inventory records error:', {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    };

    this.searchRecords = async (field, term, params = {}) => {
      try {
        console.log('Searching records with params:', {
          field,
          term,
          params,
          timestamp: new Date().toISOString()
        });
        const searchParams = {
          ...params,
          field,
          q: term
        };
        console.log('Final search params:', {
          searchParams,
          timestamp: new Date().toISOString()
        });
        const response = await api.get(ENDPOINTS.INVENTORY.SEARCH, { params: searchParams });
        console.log('Search records response:', {
          success: response.success,
          total: response.total,
          recordsCount: response.records?.length,
          firstRecord: response.records?.[0],
          lastRecord: response.records?.[response.records.length - 1],
          timestamp: new Date().toISOString()
        });
        return response;
      } catch (error) {
        console.error('Search records error:', {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    };

    this.getDuplicateRecords = async () => {
      try {
        const response = await api.get(ENDPOINTS.INVENTORY.DUPLICATES);
        return response;
      } catch (error) {
        console.error('Get duplicate records error:', error);
        throw error;
      }
    };

    this.checkItemLocation = async (serialNumber) => {
      try {
        const response = await api.get(ENDPOINTS.INVENTORY.CHECK_LOCATION(serialNumber));
        return response;
      } catch (error) {
        console.error('Check item location error:', error);
        throw error;
      }
    };

    this.addToOutbound = async (recordId) => {
      try {
        const response = await api.post(ENDPOINTS.OUTBOUND.ADD_ITEM, { recordId });
        return response;
      } catch (error) {
        console.error('Add to outbound error:', error);
        throw error;
      }
    };

    this.removeFromOutbound = async (itemId) => {
      try {
        const response = await api.delete(ENDPOINTS.OUTBOUND.REMOVE_ITEM(itemId));
        return response;
      } catch (error) {
        console.error('Remove from outbound error:', error);
        throw error;
      }
    };

    this.getOutboundItems = async () => {
      try {
        const response = await api.get(ENDPOINTS.OUTBOUND.ITEMS);
        return response;
      } catch (error) {
        console.error('Get outbound items error:', error);
        throw error;
      }
    };

    this.sendToStore = async (storeId, outboundIds = []) => {
      try {
        if (!storeId) {
          throw new Error('Store ID is required');
        }

        if (!Array.isArray(outboundIds) || outboundIds.length === 0) {
          throw new Error('At least one outbound item is required');
        }

        console.log('Sending to store:', {
          storeId,
          outboundIds,
          timestamp: new Date().toISOString()
        });

        const response = await api.post(
          ENDPOINTS.OUTBOUND.SEND_TO_STORE(storeId),
          {
            outbound_ids: outboundIds,
            store_id: parseInt(storeId, 10)
          }
        );

        if (!response?.success) {
          throw new Error(response?.error?.message || 'Failed to send items to store');
        }

        console.log('Send to store response:', {
          success: response.success,
          data: response.data,
          timestamp: new Date().toISOString()
        });

        return response;
      } catch (error) {
        console.error('Send to store error:', {
          error: error.message,
          stack: error.stack,
          storeId,
          outboundIds,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    };

    this.updateRecord = async (recordId, data) => {
      try {
        const response = await api.put(ENDPOINTS.INVENTORY.BY_ID(recordId), data);
        return response;
      } catch (error) {
        console.error('Update record error:', error);
        throw error;
      }
    };

    this.deleteRecord = async (recordId) => {
      try {
        const response = await api.delete(ENDPOINTS.INVENTORY.BY_ID(recordId));
        return response;
      } catch (error) {
        console.error('Delete record error:', error);
        throw error;
      }
    };

    this.addToOutboundBySerial = async (serialNumber) => {
      if (!serialNumber) {
        throw new Error('Serial number is required');
      }
      const searchResponse = await this.searchRecords('serialnumber', serialNumber);
      if (!searchResponse?.success || !searchResponse.records?.length) {
        throw new Error('Record not found');
      }
      const record = searchResponse.records[0];
      return this.addToOutbound(record.id);
    };

    this.sendToStoreBulk = async (storeId) => {
      if (!storeId) {
        throw new Error('Store ID is required');
      }

      try {
        console.log('Getting outbound items for bulk send');
        const outboundItems = await this.getOutboundItems();
        
        if (!outboundItems?.success || !outboundItems.items?.length) {
          throw new Error('No outbound items to send');
        }

        const outboundIds = outboundItems.items.map(item => item.outbound_item_id);
        console.log('Sending items to store:', {
          storeId,
          itemCount: outboundIds.length,
          items: outboundIds,
          timestamp: new Date().toISOString()
        });

        return await this.sendToStore(storeId, outboundIds);
      } catch (error) {
        console.error('Bulk send to store error:', {
          error: error.message,
          stack: error.stack,
          storeId,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    };

    this.getRecordById = async (id) => {
      const response = await api.get(ENDPOINTS.INVENTORY.BY_ID(id));
      return response;
    };

    this.createRecord = async (recordData) => {
      const response = await api.post(ENDPOINTS.INVENTORY.BASE, recordData);
      return response;
    };

    this.bulkUpdateRecords = async (records) => {
      const response = await api.put(`${ENDPOINTS.INVENTORY.BASE}/bulk`, { records });
      return response;
    };

    this.bulkDeleteRecords = async (ids) => {
      const response = await api.delete(`${ENDPOINTS.INVENTORY.BASE}/bulk`, {
        data: { ids }
      });
      return response;
    };

    this.exportInventory = async (params) => {
      const response = await api.get(
        `${ENDPOINTS.INVENTORY.BASE}/export${createQueryString(params)}`,
        { responseType: 'blob' }
      );
      await downloadFile(response, 'inventory-export.xlsx');
      return response;
    };

    this.importInventory = async (file) => {
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
    };

    // 清理重複記錄
    this.cleanupDuplicates = async () => {
      try {
        const response = await api.post('/records/cleanup-duplicates');
        return response;
      } catch (error) {
        console.error('Error cleaning up duplicates:', error);
        throw error;
      }
    };

    this.updateOutboundItemNotes = async (itemId, notes) => {
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      try {
        const response = await api.put(`${ENDPOINTS.OUTBOUND.UPDATE_NOTES(itemId)}`, { notes });
        return response;
      } catch (error) {
        console.error('Update notes error:', {
          error: error.message,
          stack: error.stack,
          itemId,
          timestamp: new Date().toISOString()
        });
        throw error;
      }
    };

    // Bind all methods
    Object.getOwnPropertyNames(InventoryService.prototype)
      .filter(prop => typeof this[prop] === 'function')
      .forEach(method => {
        this[method] = this[method].bind(this);
      });
  }
}

// Create service instance
const inventoryService = new InventoryService();

// Export service instance
export default inventoryService; 