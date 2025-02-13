import { ENDPOINTS } from './endpoints';

export const setupInterceptors = (api) => {
  // Request interceptor
  api.interceptors.request.use(
    (config) => {
      // Skip token for login and public endpoints
      if (config.url === ENDPOINTS.AUTH.LOGIN) {
        return config;
      }

      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('API Request:', {
          url: config.url,
          method: config.method,
          headers: config.headers
        });
      }
      
      return config;
    },
    (error) => {
      console.error('API Request Error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor
  api.interceptors.response.use(
    (response) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('API Response:', {
          url: response.config.url,
          status: response.status,
          success: response.data?.success
        });
      }
      return response.data;
    },
    (error) => {
      // Handle authentication errors
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Don't redirect if already on login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.error('API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        });
      }

      return Promise.reject(error);
    }
  );
}; 