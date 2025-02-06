import api from './api';

export const tagService = {
    // Tag Categories
    getAllCategories: () => api.get('/tags/categories'),
    createCategory: (data) => api.post('/tags/categories', data),
    updateCategory: (id, data) => api.put(`/tags/categories/${id}`, data),
    deleteCategory: (id) => api.delete(`/tags/categories/${id}`),

    // Tags
    getAllTags: (categoryId = null) => {
        const url = categoryId ? `/tags?category_id=${categoryId}` : '/tags';
        return api.get(url);
    },
    createTag: (data) => api.post('/tags', data),
    updateTag: (id, data) => api.put(`/tags/${id}`, data),
    deleteTag: (id) => api.delete(`/tags/${id}`),
    getTagRelations: (id) => api.get(`/tags/${id}/relations`),
};

export default tagService; 