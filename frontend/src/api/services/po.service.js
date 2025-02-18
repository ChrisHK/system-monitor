import api from '../index';
import { ENDPOINTS } from '../config/endpoints';
import moment from 'moment';

class POService {
    // Get new PO number
    async getNewPONumber() {
        try {
            const response = await api.get(`${ENDPOINTS.ORDER.PURCHASE.BASE}/latest-number`);
            const today = moment().format('YYYYMMDD');
            
            if (response?.success) {
                const latestNumber = response.number || 0;
                return {
                    success: true,
                    poNumber: `PO${today}${String(latestNumber + 1).padStart(3, '0')}`
                };
            }
            
            return {
                success: true,
                poNumber: `PO${today}001`  // Default format with PO prefix
            };
        } catch (error) {
            console.error('Get new PO number error:', error);
            // If API call fails, return a default PO number
            const today = moment().format('YYYYMMDD');
            return {
                success: true,
                poNumber: `PO${today}001`
            };
        }
    }

    // Get all POs
    async getAllPOs() {
        try {
            const response = await api.get(ENDPOINTS.ORDER.PURCHASE.BASE);
            return response;
        } catch (error) {
            console.error('Get all POs error:', error);
            throw error;
        }
    }

    // Get PO by ID
    async getPOById(id) {
        try {
            const response = await api.get(ENDPOINTS.ORDER.PURCHASE.BY_ID(id));
            if (response?.success) {
                // Format the response data
                const formattedData = {
                    order: {
                        id: response.data.id,
                        po_number: response.data.po_number,
                        order_date: response.data.order_date,
                        supplier: response.data.supplier,
                        status: response.data.status,
                        total_amount: response.data.total_amount,
                        notes: response.data.notes
                    },
                    items: response.data.items?.map(item => ({
                        id: item.id,
                        serialnumber: item.serialnumber,
                        cost: Number(item.cost),
                        so: item.so || '',
                        note: item.note || '',
                        categories: item.categories || []
                    })) || [],
                    categories: response.data.categories || []
                };
                return {
                    success: true,
                    data: formattedData
                };
            }
            return response;
        } catch (error) {
            console.error('Error getting PO by ID:', error);
            return {
                success: false,
                error: error.message || 'Failed to get purchase order'
            };
        }
    }

    // Create PO
    async createPO(data) {
        try {
            const response = await api.post(ENDPOINTS.ORDER.PURCHASE.BASE, data);
            return response;
        } catch (error) {
            console.error('Create PO error:', error);
            throw error;
        }
    }

    // Update PO
    async updatePO(id, data) {
        try {
            const response = await api.put(ENDPOINTS.ORDER.PURCHASE.BY_ID(id), data);
            return response;
        } catch (error) {
            console.error('Update PO error:', error);
            throw error;
        }
    }

    // Delete PO
    async deletePO(id) {
        try {
            const response = await api.delete(ENDPOINTS.ORDER.PURCHASE.BY_ID(id));
            return response;
        } catch (error) {
            console.error('Delete PO error:', error);
            throw error;
        }
    }

    // Get tags by category
    async getTagsByCategory(categoryId) {
        try {
            const response = await api.get(`${ENDPOINTS.TAGS.LIST}?category_id=${categoryId}`);
            return response;
        } catch (error) {
            console.error('Get tags by category error:', error);
            return {
                success: false,
                error,
                status: error.response?.status
            };
        }
    }

    // Get PO formats
    async getPOFormats() {
        try {
            const response = await api.get(ENDPOINTS.ORDER.PURCHASE.FORMATS.LIST);
            return response;
        } catch (error) {
            console.error('Get PO formats error:', error);
            throw error;
        }
    }

    // Create PO format
    async createPOFormat(data) {
        try {
            const response = await api.post(ENDPOINTS.ORDER.PURCHASE.FORMATS.CREATE, data);
            return response;
        } catch (error) {
            console.error('Create PO format error:', error);
            throw error;
        }
    }

    // Update PO format
    async updatePOFormat(id, data) {
        try {
            const response = await api.put(ENDPOINTS.ORDER.PURCHASE.FORMATS.UPDATE(id), data);
            return response;
        } catch (error) {
            console.error('Update PO format error:', error);
            throw error;
        }
    }

    // Delete PO format
    async deletePOFormat(id) {
        try {
            const response = await api.delete(ENDPOINTS.ORDER.PURCHASE.FORMATS.DELETE(id));
            return response;
        } catch (error) {
            console.error('Delete PO format error:', error);
            throw error;
        }
    }

    // Download PO template
    async downloadTemplate() {
        try {
            const response = await api.get(ENDPOINTS.ORDER.PURCHASE.TEMPLATE.DOWNLOAD, {
                responseType: 'blob'
            });
            return response;
        } catch (error) {
            console.error('Download template error:', error);
            throw error;
        }
    }

    // Import PO
    async importPO(formData) {
        try {
            const response = await api.post(ENDPOINTS.ORDER.PURCHASE.TEMPLATE.IMPORT, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            return response;
        } catch (error) {
            console.error('Import PO error:', error);
            throw error;
        }
    }
}

// Create service instance
const poService = new POService();

// Export service instance
export default poService; 