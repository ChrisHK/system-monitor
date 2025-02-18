import axios from 'axios';
import { getApiBaseUrl } from './config/endpoints';
import { setupInterceptors } from './config/interceptors';
import { validateEnvironment, getEnvironmentConfig } from './config/environment';

// Import services
import authService from './services/auth.service';
import userService from './services/user.service';
import inventoryService from './services/inventory.service';
import storeService from './services/store.service';
import rmaService from './services/rma.service';
import orderService from './services/order.service';
import salesService from './services/sales.service';
import tagService from './services/tag.service';

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

// Export the configured API instance
export default api;

// Export services
export {
  authService,
  userService,
  inventoryService,
  storeService,
  rmaService,
  orderService,
  salesService,
  tagService
};

// Export configuration and utilities
export { getApiBaseUrl } from './config/endpoints';
export { setupInterceptors } from './config/interceptors';
export { validateEnvironment, getEnvironmentConfig } from './config/environment'; 