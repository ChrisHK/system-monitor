import { api } from '../config/axios';
import { ENDPOINTS } from '../config/endpoints';
import { withErrorHandling } from '../utils/apiUtils';

// 基礎認證服務類
class AuthService {
    constructor() {
        // 綁定方法到實例
        this.login = this.login.bind(this);
        this.logout = this.logout.bind(this);
        this.checkAuth = this.checkAuth.bind(this);
        this.getStoredUser = this.getStoredUser.bind(this);
        this.isAuthenticated = this.isAuthenticated.bind(this);
    }

    async login(credentials) {
        const response = await api.post(ENDPOINTS.AUTH.LOGIN, credentials);
        if (response?.success && response.token) {
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
        }
        return response;
    }

    async logout() {
        try {
            // 後端沒有 logout 端點，直接清除本地存儲
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    }

    async checkAuth() {
        const response = await api.get(ENDPOINTS.AUTH.CHECK);
        return response;
    }

    getStoredUser() {
        try {
            const userStr = localStorage.getItem('user');
            return userStr ? JSON.parse(userStr) : null;
        } catch (error) {
            console.error('Error parsing stored user:', error);
            return null;
        }
    }

    isAuthenticated() {
        try {
            return !!localStorage.getItem('token');
        } catch (error) {
            console.error('Error checking authentication:', error);
            return false;
        }
    }
}

// 創建服務實例
const authService = new AuthService();

// 包裝需要錯誤處理的方法
const wrappedService = {
    login: async (credentials) => {
        try {
            return await authService.login(credentials);
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    },
    logout: async () => {
        try {
            return await authService.logout();
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    },
    checkAuth: async () => {
        try {
            return await authService.checkAuth();
        } catch (error) {
            console.error('Check auth error:', error);
            throw error;
        }
    },
    getStoredUser: authService.getStoredUser,
    isAuthenticated: authService.isAuthenticated
};

// 導出包裝後的服務
export default wrappedService; 