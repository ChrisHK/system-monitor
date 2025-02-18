import axios from 'axios';
import { getApiBaseUrl } from './endpoints';
import { setupInterceptors } from './interceptors';
import { validateEnvironment, getEnvironmentConfig } from './environment';

const createApiInstance = () => {
  try {
    // Validate environment variables
    validateEnvironment();

    // Get environment configuration
    const config = getEnvironmentConfig();
    const baseURL = getApiBaseUrl();
    const isProduction = process.env.NODE_ENV === 'production';

    // In production, ensure we're using relative paths
    const finalBaseURL = isProduction ? '/api' : baseURL;

    // Log detailed configuration
    console.log('Creating API instance:', {
      baseURL: finalBaseURL,
      originalBaseURL: baseURL,
      environment: config.isDevelopment ? 'development' : 'production',
      timeout: config.apiTimeout,
      host: window.location.host,
      protocol: window.location.protocol,
      fullUrl: `${window.location.protocol}//${window.location.host}${finalBaseURL}`,
      isProduction,
      timestamp: new Date().toISOString()
    });
    
    const instance = axios.create({
      baseURL: finalBaseURL,
      timeout: config.apiTimeout,
      headers: {
        'Content-Type': 'application/json',
      },
      // Additional axios config
      withCredentials: true, // Enable cookies if needed
      validateStatus: status => status >= 200 && status < 300
    });

    // Setup interceptors with environment config
    setupInterceptors(instance, config);

    return instance;
  } catch (error) {
    console.error('Error creating API instance:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Create a minimal instance that will handle errors properly
    const instance = axios.create({
      baseURL: '/api',
      timeout: 30000
    });
    setupInterceptors(instance, { isDevelopment: false, isProduction: true });
    return instance;
  }
};

export const api = createApiInstance(); 