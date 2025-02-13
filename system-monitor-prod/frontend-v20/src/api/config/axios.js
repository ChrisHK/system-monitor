import axios from 'axios';
import { getApiBaseUrl } from './endpoints';
import { setupInterceptors } from './interceptors';

const createApiInstance = () => {
  const instance = axios.create({
    baseURL: getApiBaseUrl(),
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    }
  });

  setupInterceptors(instance);
  return instance;
};

export const api = createApiInstance(); 