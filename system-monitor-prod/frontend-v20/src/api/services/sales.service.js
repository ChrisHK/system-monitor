import { api } from '../config/axios';
import { ENDPOINTS } from '../config/endpoints';
import { withErrorHandling, createQueryString } from '../utils/apiUtils';

class SalesService {
    async getSales(storeId, params) {
        const response = await api.get(
            `${ENDPOINTS.STORE.BY_ID(storeId)}/sales${createQueryString(params)}`
        );
        return response;
    }

    async searchSales(storeId, serialNumber) {
        const response = await api.get(
            `${ENDPOINTS.STORE.BY_ID(storeId)}/sales/search/${serialNumber}`
        );
        return response;
    }

    async addToSales(storeId, saleData) {
        const response = await api.post(
            `${ENDPOINTS.STORE.BY_ID(storeId)}/sales`,
            saleData
        );
        return response;
    }

    async updateSale(storeId, saleId, saleData) {
        const response = await api.put(
            `${ENDPOINTS.STORE.BY_ID(storeId)}/sales/${saleId}`,
            saleData
        );
        return response;
    }

    async deleteSale(storeId, saleId) {
        const response = await api.delete(
            `${ENDPOINTS.STORE.BY_ID(storeId)}/sales/${saleId}`
        );
        return response;
    }

    async bulkAddToSales(storeId, items) {
        const response = await api.post(
            `${ENDPOINTS.STORE.BY_ID(storeId)}/sales/bulk`,
            { items }
        );
        return response;
    }

    async bulkUpdateSales(storeId, items) {
        const response = await api.put(
            `${ENDPOINTS.STORE.BY_ID(storeId)}/sales/bulk`,
            { items }
        );
        return response;
    }

    async bulkDeleteSales(storeId, saleIds) {
        const response = await api.delete(
            `${ENDPOINTS.STORE.BY_ID(storeId)}/sales/bulk`,
            { data: { saleIds } }
        );
        return response;
    }
}

export default withErrorHandling(new SalesService()); 