import api from './api';
import moment from 'moment';

const poService = {
    // PO 相關
    getAllPOs: () => api.get('/purchase-orders'),
    getPOById: (id) => api.get(`/purchase-orders/${id}`),
    
    // 獲取最新的 PO Number
    getLatestPONumber: async () => {
        try {
            const today = moment().format('YYYYMMDD');
            const response = await api.get(`/purchase-orders/latest-number?date=${today}`);
            if (response?.data?.success) {
                const latestNumber = response?.data?.number || 0;
                return `${today}${String(latestNumber + 1).padStart(3, '0')}`;
            }
            return `${today}001`;  // 如果沒有找到，返回今天的第一個編號
        } catch (error) {
            console.error('Error getting latest PO number:', error);
            const today = moment().format('YYYYMMDD');
            return `${today}001`;  // 發生錯誤時返回今天的第一個編號
        }
    },

    createPO: (data) => {
        // 驗證 items
        if (!Array.isArray(data.items) || data.items.length === 0) {
            throw new Error('At least one item is required');
        }

        // 驗證每個 item 的必填字段
        data.items.forEach((item, index) => {
            if (!item.serialnumber) {
                throw new Error(`Item ${index + 1}: Serial number is required`);
            }
            if (!item.cost || isNaN(Number(item.cost)) || Number(item.cost) <= 0) {
                throw new Error(`Item ${index + 1}: Cost must be a positive number`);
            }
        });

        // 格式化數據以匹配後端期望的格式
        const formattedData = {
            order: {
                po_number: data.order.po_number,
                order_date: data.order.order_date,
                supplier: data.order.supplier?.trim() || 'none',
                status: data.order.status || 'draft',
                notes: data.order.notes?.trim() || ''
            },
            items: data.items.map(item => ({
                serialnumber: item.serialnumber,
                cost: Number(item.cost),
                so: item.so ? item.so.trim() : '',
                note: item.note ? item.note.trim() : '',
                categories: Array.isArray(item.categories) ? item.categories : []
            }))
        };

        return api.post('/purchase-orders', formattedData);
    },

    updatePO: (id, data) => {
        // 驗證 items
        if (!Array.isArray(data.items) || data.items.length === 0) {
            throw new Error('At least one item is required');
        }

        // 驗證每個 item 的必填字段
        data.items.forEach((item, index) => {
            if (!item.serialnumber) {
                throw new Error(`Item ${index + 1}: Serial number is required`);
            }
            if (!item.cost || isNaN(Number(item.cost)) || Number(item.cost) <= 0) {
                throw new Error(`Item ${index + 1}: Cost must be a positive number`);
            }
        });

        // 計算總金額
        const totalAmount = data.items.reduce((sum, item) => sum + Number(item.cost), 0);

        // 格式化數據以匹配後端期望的格式
        const formattedData = {
            po_number: data.order.po_number,
            order_date: data.order.order_date,
            supplier: data.order.supplier?.trim() || 'none',
            status: data.order.status || 'draft',
            total_amount: totalAmount,
            note: data.order.notes?.trim() || '',
            items: data.items.map(item => ({
                serialnumber: item.serialnumber,
                cost: Number(item.cost),
                so: item.so ? item.so.trim() : '',
                note: item.note ? item.note.trim() : '',
                category_id: item.category_id || null
            }))
        };

        return api.put(`/purchase-orders/${id}`, formattedData);
    },
    
    deletePO: (id) => api.delete(`/purchase-orders/${id}`),

    // 獲取所有 PO items
    getAllPOItems: async (params = {}) => {
        try {
            const queryParams = new URLSearchParams();
            if (params.search) queryParams.append('search', params.search);
            if (params.categoryId) queryParams.append('category_id', params.categoryId);
            if (params.page) queryParams.append('page', String(params.page));
            if (params.pageSize) queryParams.append('page_size', String(params.pageSize));

            // 使用正確的 API 路徑
            const url = `/purchase-orders/all-items${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
            console.log('Requesting URL:', url);
            const response = await api.get(url);
            return response;
        } catch (error) {
            console.error('Error getting PO items:', error);
            throw error;
        }
    },

    // Tag Management 相關
    getCategories: () => api.get('/tags/categories'),
    getTags: () => api.get('/tags'),
    getTagsByCategory: (categoryId) => api.get(`/tags?category_id=${categoryId}`),
    createTag: (data) => api.post('/tags', data),

    // Category 相關 (從 Tag Management 獲取)
    createCategory: (data) => api.post('/categories', data),
    updateCategory: (id, data) => api.put(`/categories/${id}`, data),
    deleteCategory: (id) => api.delete(`/categories/${id}`),

    // Tag 相關
    updateTag: (id, data) => api.put(`/tags/${id}`, data),

    // 更新 PO 項目
    updatePOItem: async (poId, itemId, data) => {
        try {
            // 直接更新單個項目
            const updateData = {
                serialnumber: data.serialnumber,
                cost: Number(data.cost),
                so: data.so || '',
                note: data.note || '',
                categories: data.categories || []
            };

            // 使用正確的 API 端點
            return api.put(`/purchase-orders/${poId}`, {
                item_id: itemId,
                ...updateData
            });
        } catch (error) {
            console.error('Error updating PO item:', error);
            throw error;
        }
    },
};

export default poService;