import { api } from '../config/axios';
import { ENDPOINTS } from '../config/endpoints';
import { withErrorHandling, createQueryString } from '../utils/apiUtils';

class RmaService {
  constructor() {
    // 綁定方法到實例
    this.getRmaItems = this.getRmaItems.bind(this);
    this.getRmaItem = this.getRmaItem.bind(this);
    this.addToRma = this.addToRma.bind(this);
    this.updateRma = this.updateRma.bind(this);
    this.deleteRma = this.deleteRma.bind(this);
    this.searchRma = this.searchRma.bind(this);
    this.sendToInventory = this.sendToInventory.bind(this);
    this.sendToStore = this.sendToStore.bind(this);
    this.updateRmaFields = this.updateRmaFields.bind(this);
    this.bulkAddToRma = this.bulkAddToRma.bind(this);
    this.bulkUpdateRma = this.bulkUpdateRma.bind(this);
    this.bulkDeleteRma = this.bulkDeleteRma.bind(this);
    this.updateInventoryRma = this.updateInventoryRma.bind(this);
    this.deleteInventoryRma = this.deleteInventoryRma.bind(this);
    this.exportToExcel = this.exportToExcel.bind(this);
    this.getRmaStats = this.getRmaStats.bind(this);
    this.processRma = this.processRma.bind(this);
    this.completeRma = this.completeRma.bind(this);
    this.failRma = this.failRma.bind(this);
  }

  async getRmaItems(storeId, params) {
    // 如果是 inventory RMA
    if (storeId === 'inventory') {
      const response = await api.get(
        `${ENDPOINTS.RMA.INVENTORY.BASE}${createQueryString(params)}`
      );
      return response;
    }
    
    // 如果是 store RMA
    const response = await api.get(
      `${ENDPOINTS.RMA.STORE.BASE(storeId)}${createQueryString(params)}`
    );
    return response;
  }

  async getRmaItem(storeId, rmaId) {
    // 如果是 inventory RMA
    if (storeId === 'inventory') {
      const response = await api.get(ENDPOINTS.RMA.INVENTORY.BY_ID(rmaId));
      return response;
    }
    
    const response = await api.get(ENDPOINTS.RMA.STORE.BY_ID(storeId, rmaId));
    return response;
  }

  async addToRma(storeId, rmaData) {
    const response = await api.post(ENDPOINTS.RMA.STORE.BASE(storeId), rmaData);
    return response;
  }

  async updateRma(storeId, rmaId, rmaData) {
    const response = await api.put(ENDPOINTS.RMA.STORE.BY_ID(storeId, rmaId), rmaData);
    return response;
  }

  async deleteRma(storeId, rmaId) {
    const response = await api.delete(ENDPOINTS.RMA.STORE.BY_ID(storeId, rmaId));
    return response;
  }

  async searchRma(storeId, serialNumber) {
    // 如果是 inventory RMA
    if (storeId === 'inventory') {
      const response = await api.get(ENDPOINTS.RMA.INVENTORY.SEARCH(serialNumber));
      return response;
    }
    
    const response = await api.get(ENDPOINTS.RMA.STORE.SEARCH(storeId, serialNumber));
    return response;
  }

  async sendToInventory(storeId, rmaId) {
    const response = await api.put(ENDPOINTS.RMA.STORE.SEND_TO_INVENTORY(storeId, rmaId));
    return response;
  }

  async sendToStore(storeId, rmaId) {
    const response = await api.put(ENDPOINTS.RMA.STORE.SEND_TO_STORE(storeId, rmaId));
    return response;
  }

  async updateRmaFields(storeId, rmaId, fields) {
    const response = await api.put(
      ENDPOINTS.RMA.STORE.UPDATE_FIELDS(storeId, rmaId),
      fields
    );
    return response;
  }

  async bulkAddToRma(storeId, items) {
    const response = await api.post(
      `${ENDPOINTS.RMA.STORE.BASE(storeId)}/bulk`,
      { items }
    );
    return response;
  }

  async bulkUpdateRma(storeId, items) {
    const response = await api.put(
      `${ENDPOINTS.RMA.STORE.BASE(storeId)}/bulk`,
      { items }
    );
    return response;
  }

  async bulkDeleteRma(storeId, rmaIds) {
    const response = await api.delete(
      `${ENDPOINTS.RMA.STORE.BASE(storeId)}/bulk`,
      { data: { rmaIds } }
    );
    return response;
  }

  // Inventory RMA specific methods
  async processRma(rmaId) {
    const response = await api.put(ENDPOINTS.RMA.INVENTORY.PROCESS(rmaId));
    return response;
  }

  async completeRma(rmaId) {
    const response = await api.put(ENDPOINTS.RMA.INVENTORY.COMPLETE(rmaId));
    return response;
  }

  async failRma(rmaId, reason) {
    const response = await api.put(
      ENDPOINTS.RMA.INVENTORY.FAIL(rmaId),
      { reason }
    );
    return response;
  }

  async getRmaStats() {
    const response = await api.get(ENDPOINTS.RMA.INVENTORY.STATS);
    return response;
  }

  async updateInventoryRma(rmaId, data) {
    const response = await api.put(ENDPOINTS.RMA.INVENTORY.UPDATE(rmaId), data);
    return response;
  }

  async deleteInventoryRma(rmaId) {
    const response = await api.delete(ENDPOINTS.RMA.INVENTORY.DELETE(rmaId));
    return response;
  }

  async exportToExcel(params) {
    const response = await api.get(
      `${ENDPOINTS.RMA.INVENTORY.EXPORT}${createQueryString(params)}`,
      { responseType: 'blob' }
    );
    return response;
  }
}

export default withErrorHandling(new RmaService()); 