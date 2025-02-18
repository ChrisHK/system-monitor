import api from '../index';
import { ENDPOINTS } from '../config/endpoints';

class TagService {
    // Categories
    async getCategories() {
        try {
            const response = await api.get(ENDPOINTS.TAGS.CATEGORIES.LIST);
            return response;
        } catch (error) {
            console.error('Get categories error:', error);
            throw error;
        }
    }

    // Tags
    async getTags() {
        try {
            const response = await api.get(ENDPOINTS.TAGS.LIST);
            return response;
        } catch (error) {
            console.error('Get tags error:', error);
            throw error;
        }
    }

    async createTag(tagData) {
        try {
            const response = await api.post(ENDPOINTS.TAGS.CREATE, tagData);
            return response;
        } catch (error) {
            console.error('Create tag error:', error);
            throw error;
        }
    }

    async updateTag(tagId, tagData) {
        try {
            const response = await api.put(ENDPOINTS.TAGS.BY_ID(tagId), tagData);
            return response;
        } catch (error) {
            console.error('Update tag error:', error);
            throw error;
        }
    }

    async deleteTag(tagId) {
        try {
            const response = await api.delete(ENDPOINTS.TAGS.BY_ID(tagId));
            return response;
        } catch (error) {
            console.error('Delete tag error:', error);
            throw error;
        }
    }

    async createCategory(categoryData) {
        try {
            const response = await api.post(ENDPOINTS.TAGS.CATEGORIES.CREATE, categoryData);
            return response;
        } catch (error) {
            console.error('Create category error:', error);
            throw error;
        }
    }

    async updateCategory(categoryId, categoryData) {
        try {
            const response = await api.put(ENDPOINTS.TAGS.CATEGORIES.BY_ID(categoryId), categoryData);
            return response;
        } catch (error) {
            console.error('Update category error:', error);
            throw error;
        }
    }

    async deleteCategory(categoryId) {
        try {
            const response = await api.delete(ENDPOINTS.TAGS.CATEGORIES.BY_ID(categoryId));
            return response;
        } catch (error) {
            console.error('Delete category error:', error);
            throw error;
        }
    }

    // Tag Assignment
    async assignTag(recordId, tagData) {
        try {
            const response = await api.post(ENDPOINTS.TAGS.ASSIGN.ADD(recordId), tagData);
            return response;
        } catch (error) {
            console.error('Assign tag error:', error);
            throw error;
        }
    }

    async removeTag(recordId, tagId) {
        try {
            const response = await api.delete(ENDPOINTS.TAGS.ASSIGN.REMOVE(recordId, tagId));
            return response;
        } catch (error) {
            console.error('Remove tag error:', error);
            throw error;
        }
    }

    async batchAssignTags(assignments) {
        try {
            const response = await api.post(ENDPOINTS.TAGS.ASSIGN.BATCH, assignments);
            return response;
        } catch (error) {
            console.error('Batch assign tags error:', error);
            throw error;
        }
    }
}

// Create service instance
const tagService = new TagService();

// Export service instance
export default tagService; 