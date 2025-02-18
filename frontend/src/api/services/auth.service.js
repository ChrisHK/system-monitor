import api from '../index';
import { ENDPOINTS } from '../config/endpoints';
import { ERROR_CODES } from '../utils/errorHandler';

// 基礎認證服務類
class AuthService {
    constructor() {
        // Define all methods first
        this.login = async (formData) => {
            try {
                // Debug log raw input
                console.log('Login method called with:', {
                    formData: typeof formData === 'object' ? 'object' : typeof formData,
                    hasFormData: !!formData,
                    rawFormData: formData,
                    timestamp: new Date().toISOString()
                });

                // Extract credentials from form data
                let username, password;
                
                if (typeof formData === 'object') {
                    // If formData is an object, extract username and password
                    username = formData.username;
                    password = formData.password;
                } else {
                    // If old style parameters are used
                    username = arguments[0];
                    password = arguments[1];
                }

                // Validate input
                if (!username || !password) {
                    console.warn('Login validation failed:', {
                        hasUsername: !!username,
                        hasPassword: !!password,
                        usernameType: typeof username,
                        passwordType: typeof password
                    });
                    throw new Error('Username and password are required');
                }

                // Ensure username and password are strings
                const credentials = {
                    username: String(username).trim(),
                    password: String(password)
                };

                console.log('Processed credentials:', { 
                    username: credentials.username,
                    hasPassword: !!credentials.password,
                    timestamp: new Date().toISOString()
                });

                const response = await api.post(ENDPOINTS.AUTH.LOGIN, credentials);
                
                console.log('Login response:', {
                    success: response.success,
                    hasToken: !!response.token,
                    hasUser: !!response.user,
                    timestamp: new Date().toISOString()
                });
                
                if (response?.token) {
                    localStorage.setItem('token', response.token);
                    localStorage.setItem('user', JSON.stringify(response.user));
                    console.log('Authentication data stored successfully');
                } else {
                    console.warn('Login response missing token or user data');
                }
                
                return response;
            } catch (error) {
                console.error('Login error:', {
                    message: error.message,
                    type: error.name,
                    response: error.response?.data,
                    status: error.response?.status,
                    timestamp: new Date().toISOString()
                });
                // Transform error for better user experience
                const errorMessage = error.response?.data?.error || error.message || 'Login failed';
                throw new Error(errorMessage);
            }
        };

        this.logout = async () => {
            try {
                await api.post(ENDPOINTS.AUTH.LOGOUT);
            } catch (error) {
                console.error('Logout error:', error);
            } finally {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        };

        this.checkAuth = async () => {
            try {
                const response = await api.get(ENDPOINTS.AUTH.CHECK);
                return response;
            } catch (error) {
                console.error('Check auth error:', error);
                throw error;
            }
        };

        this.refreshToken = async () => {
            try {
                const response = await api.post(ENDPOINTS.AUTH.REFRESH_TOKEN);
                if (response?.token) {
                    localStorage.setItem('token', response.token);
                }
                return response;
            } catch (error) {
                console.error('Refresh token error:', error);
                throw error;
            }
        };

        this.getStoredUser = () => {
            try {
                const userStr = localStorage.getItem('user');
                return userStr ? JSON.parse(userStr) : null;
            } catch (error) {
                console.error('Get stored user error:', error);
                return null;
            }
        };

        this.getToken = () => {
            return localStorage.getItem('token');
        };

        this.isAuthenticated = () => {
            return !!this.getToken();
        };

        this.validateToken = async () => {
            try {
                const response = await api.post(ENDPOINTS.AUTH.VALIDATE_TOKEN);
                return response;
            } catch (error) {
                console.error('Validate token error:', error);
                throw error;
            }
        };

        this.updatePassword = async (currentPassword, newPassword) => {
            try {
                const response = await api.post(ENDPOINTS.AUTH.UPDATE_PASSWORD, {
                    currentPassword,
                    newPassword
                });
                return response;
            } catch (error) {
                console.error('Update password error:', error);
                throw error;
            }
        };

        this.requestPasswordReset = async (email) => {
            try {
                const response = await api.post(ENDPOINTS.AUTH.REQUEST_PASSWORD_RESET, {
                    email
                });
                return response;
            } catch (error) {
                console.error('Request password reset error:', error);
                throw error;
            }
        };

        this.resetPassword = async (token, newPassword) => {
            try {
                const response = await api.post(ENDPOINTS.AUTH.RESET_PASSWORD, {
                    token,
                    newPassword
                });
                return response;
            } catch (error) {
                console.error('Reset password error:', error);
                throw error;
            }
        };

        // Bind all methods
        Object.getOwnPropertyNames(AuthService.prototype)
            .filter(prop => typeof this[prop] === 'function')
            .forEach(method => {
                this[method] = this[method].bind(this);
            });
    }
}

// 創建服務實例
const authService = new AuthService();

// 導出服務實例
export default authService; 