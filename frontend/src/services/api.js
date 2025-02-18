import axios from 'axios';
import { getApiBaseUrl } from '../api/config/endpoints';
import { setupInterceptors } from '../api/config/interceptors';
import { validateEnvironment, getEnvironmentConfig } from '../api/config/environment';

// Create and configure API instance
const api = (() => {
  const config = getEnvironmentConfig();
  const baseURL = getApiBaseUrl();
  const isProduction = process.env.NODE_ENV === 'production';

  // In production, always use relative path
  const finalBaseURL = isProduction ? '/api' : baseURL;

  const instance = axios.create({
    baseURL: finalBaseURL,
    timeout: config.apiTimeout,
    headers: {
      'Content-Type': 'application/json',
    }
  });

  // Setup interceptors
  setupInterceptors(instance, config);

  return instance;
})();

export default api; 