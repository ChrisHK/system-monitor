import { ENDPOINTS } from './endpoints';
import { ERROR_CODES } from '../utils/errorHandler';
import { getEnvironmentConfig } from './environment';

const PUBLIC_ENDPOINTS = [
  '/auth/login',
  '/auth/request-password-reset',
  '/auth/reset-password',
  '/health'
];

const isPublicEndpoint = (url) => {
  return PUBLIC_ENDPOINTS.some(endpoint => url.includes(endpoint));
};

const handleAuthError = (error) => {
  if (error.response?.status === 401) {
    // Clear auth data on 401 errors
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Only redirect if not already on login page and not a public endpoint
    if (!window.location.pathname.includes('/login') && 
        !isPublicEndpoint(error.config?.url)) {
      window.location.href = '/login';
    }
  }
  return Promise.reject(error);
};

const isJsonResponse = (response) => {
  const contentType = response.headers?.['content-type'] || '';
  return contentType.includes('application/json');
};

const makeRelativeUrl = (url) => {
  try {
    // If it's already a relative URL, return as is
    if (url.startsWith('/')) {
      return url;
    }

    // Handle absolute URLs
    if (url.startsWith('http')) {
      const urlObj = new URL(url);
      const relativePath = `${urlObj.pathname}${urlObj.search}${urlObj.hash}`;
      
      console.log('Converting absolute URL to relative:', {
        original: url,
        relative: relativePath,
        timestamp: new Date().toISOString()
      });
      
      return relativePath;
    }

    // If not absolute and not starting with /, add /
    return `/${url}`;
  } catch (e) {
    console.warn('URL parsing failed:', {
      url,
      error: e.message,
      timestamp: new Date().toISOString()
    });
    // If parsing fails, ensure the URL starts with /
    return url.startsWith('/') ? url : `/${url}`;
  }
};

export const setupInterceptors = (instance, config) => {
  const envConfig = getEnvironmentConfig();
  const isProduction = process.env.NODE_ENV === 'production';

  // Request interceptor
  instance.interceptors.request.use(
    (reqConfig) => {
      // Ensure proper content type
      reqConfig.headers = reqConfig.headers || {};
      reqConfig.headers['Accept'] = 'application/json';
      
      // Don't set Content-Type for FormData
      if (!(reqConfig.data instanceof FormData)) {
        reqConfig.headers['Content-Type'] = 'application/json';
      }

      // In production, ensure all URLs are relative
      if (isProduction) {
        const originalUrl = reqConfig.url;
        reqConfig.url = makeRelativeUrl(reqConfig.url || '');

        console.log('Request URL transformation:', {
          original: originalUrl,
          transformed: reqConfig.url,
          baseURL: reqConfig.baseURL,
          fullUrl: `${window.location.protocol}//${window.location.host}${reqConfig.url}`,
          isProduction,
          timestamp: new Date().toISOString()
        });
      }

      const token = localStorage.getItem('token');
      if (!isPublicEndpoint(reqConfig.url) && token) {
        reqConfig.headers.Authorization = `Bearer ${token}`;
      }

      // Log request details
      console.log('API Request:', {
        url: reqConfig.url,
        baseURL: reqConfig.baseURL,
        method: reqConfig.method,
        headers: reqConfig.headers,
        hasToken: !!token,
        environment: envConfig.isDevelopment ? 'development' : 'production',
        fullUrl: `${reqConfig.baseURL || ''}${reqConfig.url}`,
        isProduction,
        timestamp: new Date().toISOString()
      });

      return reqConfig;
    },
    (error) => {
      console.error('Request interceptor error:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      return Promise.reject(error);
    }
  );

  // Response interceptor
  instance.interceptors.response.use(
    (response) => {
      // Handle blob responses
      if (response.config.responseType === 'blob') {
        return response;
      }

      // Check if response is JSON
      if (!isJsonResponse(response)) {
        const error = {
          code: ERROR_CODES.INVALID_RESPONSE,
          message: 'Expected JSON response but received different content type',
          details: {
            url: response.config.url,
            baseURL: response.config.baseURL,
            fullUrl: `${response.config.baseURL || ''}${response.config.url}`,
            contentType: response.headers['content-type'],
            status: response.status,
            timestamp: new Date().toISOString()
          }
        };
        console.error('Non-JSON response:', error);
        return Promise.reject(error);
      }

      // Handle successful login response
      if (response.config.url?.includes('/auth/login') && response.data?.token) {
        try {
          localStorage.setItem('token', response.data.token);
          if (response.data.user) {
            localStorage.setItem('user', JSON.stringify(response.data.user));
          }
          console.log('Authentication data stored successfully');
        } catch (error) {
          console.error('Error storing auth data:', {
            error: error.message,
            timestamp: new Date().toISOString()
          });
          return Promise.reject({
            code: ERROR_CODES.STORAGE_ERROR,
            message: 'Failed to store authentication data'
          });
        }
      }

      // Log successful response
      console.log('API Response:', {
        url: response.config.url,
        baseURL: response.config.baseURL,
        method: response.config.method,
        status: response.status,
        data: response.data,
        timestamp: new Date().toISOString()
      });

      // Ensure success is set
      response.data.success = response.data.success ?? true;
      return response.data;
    },
    (error) => {
      // Log detailed error information
      console.error('API Error:', {
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        fullUrl: error.config ? `${error.config.baseURL || ''}${error.config.url}` : undefined,
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
        headers: error.response?.headers,
        environment: envConfig.isDevelopment ? 'development' : 'production',
        timestamp: new Date().toISOString()
      });

      // Handle HTML responses
      if (error.response && !isJsonResponse(error.response)) {
        const errorDetails = {
          code: ERROR_CODES.INVALID_RESPONSE,
          message: 'Expected JSON response but received HTML',
          details: {
            url: error.config?.url,
            baseURL: error.config?.baseURL,
            fullUrl: error.config ? `${error.config.baseURL || ''}${error.config.url}` : undefined,
            status: error.response?.status,
            contentType: error.response?.headers?.['content-type'],
            timestamp: new Date().toISOString()
          }
        };
        console.error('HTML Response Error:', errorDetails);
        return Promise.reject(errorDetails);
      }

      // Handle auth errors (401)
      if (error.response?.status === 401) {
        return handleAuthError(error);
      }

      // Handle network errors
      if (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED') {
        console.error('Network error:', {
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          fullUrl: error.config ? `${error.config.baseURL || ''}${error.config.url}` : undefined,
          code: error.code,
          message: error.message,
          headers: error.config?.headers,
          timestamp: new Date().toISOString()
        });

        return Promise.reject({
          code: ERROR_CODES.NETWORK_ERROR,
          message: 'Network error occurred',
          details: {
            url: error.config?.url,
            code: error.code,
            message: error.message
          }
        });
      }

      // Handle timeout errors
      if (error.code === 'ECONNABORTED' && error.message.includes('timeout')) {
        console.error('Request timeout:', {
          url: error.config?.url,
          baseURL: error.config?.baseURL,
          fullUrl: error.config ? `${error.config.baseURL || ''}${error.config.url}` : undefined,
          timeout: error.config?.timeout,
          timestamp: new Date().toISOString()
        });

        return Promise.reject({
          code: ERROR_CODES.TIMEOUT,
          message: 'Request timeout',
          details: {
            url: error.config?.url,
            timeout: error.config?.timeout
          }
        });
      }

      // Return error response data if available
      if (error.response?.data) {
        return Promise.reject({
          ...error.response.data,
          status: error.response.status
        });
      }

      return Promise.reject({
        code: ERROR_CODES.UNKNOWN,
        message: error.message || 'Unknown error occurred',
        details: error
      });
    }
  );
}; 