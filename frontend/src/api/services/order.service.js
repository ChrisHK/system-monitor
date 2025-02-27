import { api } from '../config/axios';
import { ENDPOINTS } from '../config/endpoints';
import { withErrorHandling, createQueryString } from '../utils/apiUtils';

class OrderService {
  constructor() {
    // 綁定方法到實例
    this.getOrders = this.getOrders.bind(this);
    this.getOrder = this.getOrder.bind(this);
    this.createOrder = this.createOrder.bind(this);
    this.updateOrder = this.updateOrder.bind(this);
    this.deleteOrder = this.deleteOrder.bind(this);
    this.getStoreOrders = this.getStoreOrders.bind(this);
    this.getStoreOrder = this.getStoreOrder.bind(this);
    this.searchStoreOrders = this.searchStoreOrders.bind(this);
    this.exportStoreOrders = this.exportStoreOrders.bind(this);
    this.getPurchaseOrders = this.getPurchaseOrders.bind(this);
    this.getPurchaseOrder = this.getPurchaseOrder.bind(this);
    this.searchPurchaseOrders = this.searchPurchaseOrders.bind(this);
    this.exportPurchaseOrders = this.exportPurchaseOrders.bind(this);
    this.addToOrder = this.addToOrder.bind(this);
    this.addToRma = this.addToRma.bind(this);
    this.updateOrderItemPrice = this.updateOrderItemPrice.bind(this);
    this.updateOrderItemPayMethod = this.updateOrderItemPayMethod.bind(this);
    this.updateOrderItemNotes = this.updateOrderItemNotes.bind(this);
    this.deleteOrderItem = this.deleteOrderItem.bind(this);
    this.saveOrder = this.saveOrder.bind(this);
    this.deleteCompletedOrder = this.deleteCompletedOrder.bind(this);
  }

  // Regular Orders
  async getOrders(params) {
    const response = await api.get(
      `${ENDPOINTS.ORDER.BASE}${createQueryString(params)}`
    );
    return response;
  }

  async getOrder(id) {
    const response = await api.get(ENDPOINTS.ORDER.BY_ID(id));
    return response;
  }

  async createOrder(orderData) {
    const response = await api.post(ENDPOINTS.ORDER.BASE, orderData);
    return response;
  }

  async updateOrder(id, orderData) {
    const response = await api.put(ENDPOINTS.ORDER.BY_ID(id), orderData);
    return response;
  }

  async deleteOrder(storeId, orderId) {
    try {
      const response = await api.delete(`/orders/stores/${storeId}/orders/${orderId}`);
      return response;
    } catch (error) {
      throw this.handleApiError(error);
    }
  }

  async bulkCreateOrders(orders) {
    const response = await api.post(`${ENDPOINTS.ORDER.BASE}/bulk`, { orders });
    return response;
  }

  async bulkUpdateOrders(orders) {
    const response = await api.put(`${ENDPOINTS.ORDER.BASE}/bulk`, { orders });
    return response;
  }

  async bulkDeleteOrders(orderIds) {
    const response = await api.delete(`${ENDPOINTS.ORDER.BASE}/bulk`, {
      data: { orderIds }
    });
    return response;
  }

  // Store Orders
  async getStoreOrders(storeId, params) {
    const response = await api.get(
      `${ENDPOINTS.ORDER.STORE.BASE(storeId)}${createQueryString(params)}`
    );
    return response;
  }

  async getStoreOrder(storeId, orderId) {
    const response = await api.get(ENDPOINTS.ORDER.STORE.BY_ID(storeId, orderId));
    return response;
  }

  async searchStoreOrders(storeId, serialNumber) {
    const response = await api.get(ENDPOINTS.ORDER.STORE.SEARCH(storeId, serialNumber));
    return response;
  }

  async exportStoreOrders(storeId, params) {
    const response = await api.get(
      `${ENDPOINTS.ORDER.STORE.EXPORT(storeId)}${createQueryString(params)}`,
      { responseType: 'blob' }
    );
    return response;
  }

  // Purchase Orders
  async getPurchaseOrders(params) {
    const response = await api.get(
      `${ENDPOINTS.ORDER.PURCHASE.BASE}${createQueryString(params)}`
    );
    return response;
  }

  async getPurchaseOrder(id) {
    const response = await api.get(ENDPOINTS.ORDER.PURCHASE.BY_ID(id));
    return response;
  }

  async searchPurchaseOrders(serialNumber) {
    const response = await api.get(ENDPOINTS.ORDER.PURCHASE.SEARCH(serialNumber));
    return response;
  }

  async exportPurchaseOrders(params) {
    const response = await api.get(
      `${ENDPOINTS.ORDER.PURCHASE.EXPORT}${createQueryString(params)}`,
      { responseType: 'blob' }
    );
    return response;
  }

  // Store Order specific methods
  async addToOrder(storeId, items) {
    // 確保每個項目都有支付方式
    const itemsWithDefaults = items.map(item => ({
      ...item,
      payMethod: item.payMethod || 'credit_card'
    }));

    const response = await api.post(
      ENDPOINTS.ORDER.STORE.BASE(storeId),
      { items: itemsWithDefaults }
    );
    return response;
  }

  async addToRma(storeId, rmaData) {
    const response = await api.post(
      ENDPOINTS.RMA.STORE.BASE(storeId),
      rmaData
    );
    return response;
  }

  async updateOrderItemPrice(storeId, itemId, price) {
    const response = await api.put(
      ENDPOINTS.ORDER.STORE.UPDATE_PRICE(storeId, itemId),
      { price }
    );
    return response;
  }

  async updateOrderItemPayMethod(storeId, itemId, payMethod) {
    try {
      const endpoint = ENDPOINTS.ORDER.STORE.UPDATE_PAY_METHOD(storeId, itemId);
      const response = await api.put(endpoint, { payMethod });
      return response;
    } catch (error) {
      console.error('Error updating payment method:', error);
      throw error;
    }
  }

  async updateOrderItemNotes(storeId, itemId, notes) {
    const response = await api.put(
      ENDPOINTS.ORDER.STORE.UPDATE_NOTES(storeId, itemId),
      { notes }
    );
    return response;
  }

  async deleteOrderItem(storeId, itemId) {
    const response = await api.delete(
      ENDPOINTS.ORDER.STORE.DELETE_ITEM(storeId, itemId)
    );
    return response;
  }

  async saveOrder(storeId, orderId) {
    const response = await api.put(
      ENDPOINTS.ORDER.STORE.SAVE(storeId, orderId)
    );
    return response;
  }

  async deleteCompletedOrder(storeId, orderId) {
    const response = await api.delete(
      ENDPOINTS.ORDER.STORE.DELETE_COMPLETED(storeId, orderId)
    );
    return response;
  }
}

export default withErrorHandling(new OrderService()); 