import api from '../index';
import { ENDPOINTS } from '../config/endpoints';
import { withErrorHandling } from '../utils/apiUtils';

class UserService {
    constructor() {
        // 綁定方法到實例
        this.getCurrentUser = this.getCurrentUser.bind(this);
        this.getUsers = this.getUsers.bind(this);
        this.createUser = this.createUser.bind(this);
        this.updateUser = this.updateUser.bind(this);
        this.deleteUser = this.deleteUser.bind(this);
        this.getGroups = this.getGroups.bind(this);
        this.createGroup = this.createGroup.bind(this);
        this.updateGroup = this.updateGroup.bind(this);
        this.updateGroupPermissions = this.updateGroupPermissions.bind(this);
        this.updateStorePermissions = this.updateStorePermissions.bind(this);
        this.deleteGroup = this.deleteGroup.bind(this);
        this.updateProfile = this.updateProfile.bind(this);
        this.getUserById = this.getUserById.bind(this);
        this.getUserRoles = this.getUserRoles.bind(this);
        this.updateUserRole = this.updateUserRole.bind(this);
        this.getUserPermissions = this.getUserPermissions.bind(this);
        this.updateUserPermissions = this.updateUserPermissions.bind(this);
        this.updateUserPassword = this.updateUserPassword.bind(this);
    }

    async getCurrentUser() {
        try {
            const response = await api.get(ENDPOINTS.USER.CURRENT);
            return response;
        } catch (error) {
            console.error('Get current user error:', error);
            throw error;
        }
    }

    async updateProfile(data) {
        try {
            const response = await api.put(ENDPOINTS.USER.UPDATE_PROFILE, data);
            return response;
        } catch (error) {
            console.error('Update profile error:', error);
            throw error;
        }
    }

    async getUsers(params) {
        try {
            const response = await api.get(ENDPOINTS.USER.LIST, { params });
            return response;
        } catch (error) {
            console.error('Get users error:', error);
            throw error;
        }
    }

    async getUserById(userId) {
        try {
            const response = await api.get(ENDPOINTS.USER.BY_ID(userId));
            return response;
        } catch (error) {
            console.error('Get user by ID error:', error);
            throw error;
        }
    }

    async createUser(userData) {
        try {
            const response = await api.post(ENDPOINTS.USER.CREATE, userData);
            return response;
        } catch (error) {
            console.error('Create user error:', error);
            throw error;
        }
    }

    async updateUser(userId, userData) {
        try {
            const response = await api.put(ENDPOINTS.USER.BY_ID(userId), userData);
            return response;
        } catch (error) {
            console.error('Update user error:', error);
            throw error;
        }
    }

    async deleteUser(userId) {
        try {
            const response = await api.delete(ENDPOINTS.USER.BY_ID(userId));
            return response;
        } catch (error) {
            console.error('Delete user error:', error);
            throw error;
        }
    }

    async getUserRoles() {
        try {
            const response = await api.get(ENDPOINTS.USER.ROLES);
            return response;
        } catch (error) {
            console.error('Get user roles error:', error);
            throw error;
        }
    }

    async updateUserRole(userId, roleId) {
        try {
            const response = await api.put(ENDPOINTS.USER.UPDATE_ROLE(userId), { roleId });
            return response;
        } catch (error) {
            console.error('Update user role error:', error);
            throw error;
        }
    }

    async getUserPermissions() {
        try {
            const response = await api.get(ENDPOINTS.USER.PERMISSIONS);
            return response;
        } catch (error) {
            console.error('Get user permissions error:', error);
            throw error;
        }
    }

    async updateUserPermissions(userId, permissions) {
        try {
            const response = await api.put(ENDPOINTS.USER.UPDATE_PERMISSIONS(userId), { permissions });
            return response;
        } catch (error) {
            console.error('Update user permissions error:', error);
            throw error;
        }
    }

    async getGroups() {
        const response = await api.get(ENDPOINTS.GROUP.LIST);
        return response;
    }

    async createGroup({ name, description, main_permissions, store_permissions }) {
        // Prepare store permissions array
        const storePermissionsArray = store_permissions.map(permissions => ({
            store_id: permissions.store_id,
            inventory: permissions.inventory === true,
            orders: permissions.orders === true,
            rma: permissions.rma === true,
            outbound: permissions.outbound === true
        }));

        // Prepare the payload
        const payload = {
            name: name.trim(),
            description: description.trim(),
            main_permissions,
            store_permissions: storePermissionsArray
        };
        
        console.log('Creating group with data:', payload);
        const response = await api.post(ENDPOINTS.GROUP.CREATE, payload);
        return response;
    }

    async updateGroup(groupId, groupData) {
        try {
            console.log('Updating group with data:', {
                ...groupData,
                timestamp: new Date().toISOString()
            });

            // Extract all necessary data
            const { name, description, main_permissions, store_permissions } = groupData;

            // Prepare store permissions array
            const storePermissionsArray = store_permissions.map(permissions => ({
                store_id: permissions.store_id,
                inventory: permissions.inventory === true,
                orders: permissions.orders === true,
                rma: permissions.rma === true,
                outbound: permissions.outbound === true,
                bulk_select: permissions.bulk_select === true
            }));

            // Prepare the payload
            const payload = {
                name: name.trim(),
                description: description.trim(),
                main_permissions,
                store_permissions: storePermissionsArray
            };

            const response = await api.put(ENDPOINTS.GROUP.UPDATE(groupId), payload);
            return response;
        } catch (error) {
            console.error('Update group error:', {
                error: error.message,
                groupId,
                groupData
            });
            throw error;
        }
    }

    async updateGroupPermissions(groupId, permissions) {
        // 檢查 store_permissions 是否已經是陣列
        if (permissions.store_permissions && !Array.isArray(permissions.store_permissions)) {
            const storePermissionsArray = [];
            Object.entries(permissions.store_permissions).forEach(([storeId, perms]) => {
                storePermissionsArray.push({
                    store_id: storeId,
                    inventory: perms.inventory === true ? '1' : '0',
                    orders: perms.orders === true ? '1' : '0',
                    rma: perms.rma === true ? '1' : '0',
                    outbound: perms.outbound === true ? '1' : '0',
                    bulk_select: perms.bulk_select === true ? '1' : '0'
                });
            });
            permissions.store_permissions = storePermissionsArray;
        }
        
        console.log('Updating group permissions with data:', permissions);
        const response = await api.put(
            ENDPOINTS.GROUP.PERMISSIONS.UPDATE(groupId),
            permissions
        );
        return response;
    }

    async updateStorePermissions(groupId, storeId, permissions) {
        // 轉換權限為字符串格式
        const cleanedPermissions = {
            inventory: permissions.inventory === true ? '1' : '0',
            orders: permissions.orders === true ? '1' : '0',
            rma: permissions.rma === true ? '1' : '0',
            outbound: permissions.outbound === true ? '1' : '0'
        };
        
        console.log('Updating store permissions with data:', cleanedPermissions);
        const response = await api.put(
            ENDPOINTS.GROUP.PERMISSIONS.STORE(groupId, storeId),
            cleanedPermissions
        );
        return response;
    }

    async deleteGroup(groupId) {
        const response = await api.delete(ENDPOINTS.GROUP.DELETE(groupId));
        return response;
    }

    async updateUserPassword(userId, password) {
        try {
            const response = await api.put(ENDPOINTS.USER.UPDATE_PASSWORD(userId), { password });
            return response;
        } catch (error) {
            console.error('Update user password error:', error);
            throw error;
        }
    }
}

// 創建服務實例
const userService = new UserService();

// 包裝所有方法
const wrappedService = {
    getCurrentUser: async () => {
        try {
            return await userService.getCurrentUser();
        } catch (error) {
            console.error('Get current user error:', error);
            throw error;
        }
    },
    getUsers: async (params) => {
        try {
            return await userService.getUsers(params);
        } catch (error) {
            console.error('Get users error:', error);
            throw error;
        }
    },
    createUser: async (userData) => {
        try {
            return await userService.createUser(userData);
        } catch (error) {
            console.error('Create user error:', error);
            throw error;
        }
    },
    updateUser: async (userId, userData) => {
        try {
            return await userService.updateUser(userId, userData);
        } catch (error) {
            console.error('Update user error:', error);
            throw error;
        }
    },
    deleteUser: async (userId) => {
        try {
            return await userService.deleteUser(userId);
        } catch (error) {
            console.error('Delete user error:', error);
            throw error;
        }
    },
    getGroups: async () => {
        try {
            return await userService.getGroups();
        } catch (error) {
            console.error('Get groups error:', error);
            throw error;
        }
    },
    createGroup: async (groupData) => {
        try {
            return await userService.createGroup(groupData);
        } catch (error) {
            console.error('Create group error:', error);
            throw error;
        }
    },
    updateGroup: async (groupId, groupData) => {
        try {
            return await userService.updateGroup(groupId, groupData);
        } catch (error) {
            console.error('Update group error:', error);
            throw error;
        }
    },
    updateGroupPermissions: async (groupId, permissions) => {
        try {
            return await userService.updateGroupPermissions(groupId, permissions);
        } catch (error) {
            console.error('Update group permissions error:', error);
            throw error;
        }
    },
    updateStorePermissions: async (groupId, storeId, permissions) => {
        try {
            return await userService.updateStorePermissions(groupId, storeId, permissions);
        } catch (error) {
            console.error('Update store permissions error:', error);
            throw error;
        }
    },
    deleteGroup: async (groupId) => {
        try {
            return await userService.deleteGroup(groupId);
        } catch (error) {
            console.error('Delete group error:', error);
            throw error;
        }
    },
    updateProfile: async (data) => {
        try {
            return await userService.updateProfile(data);
        } catch (error) {
            console.error('Update profile error:', error);
            throw error;
        }
    },
    getUserById: async (userId) => {
        try {
            return await userService.getUserById(userId);
        } catch (error) {
            console.error('Get user by ID error:', error);
            throw error;
        }
    },
    getUserRoles: async () => {
        try {
            return await userService.getUserRoles();
        } catch (error) {
            console.error('Get user roles error:', error);
            throw error;
        }
    },
    updateUserRole: async (userId, roleId) => {
        try {
            return await userService.updateUserRole(userId, roleId);
        } catch (error) {
            console.error('Update user role error:', error);
            throw error;
        }
    },
    getUserPermissions: async () => {
        try {
            return await userService.getUserPermissions();
        } catch (error) {
            console.error('Get user permissions error:', error);
            throw error;
        }
    },
    updateUserPermissions: async (userId, permissions) => {
        try {
            return await userService.updateUserPermissions(userId, permissions);
        } catch (error) {
            console.error('Update user permissions error:', error);
            throw error;
        }
    },
    updateUserPassword: async (userId, password) => {
        try {
            return await userService.updateUserPassword(userId, password);
        } catch (error) {
            console.error('Update user password error:', error);
            throw error;
        }
    }
};

export default wrappedService; 