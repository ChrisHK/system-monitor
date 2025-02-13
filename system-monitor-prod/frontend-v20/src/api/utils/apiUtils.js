import { handleApiError } from './errorHandler';

export const createApiMethod = (apiCall) => async (...args) => {
  try {
    return await apiCall(...args);
  } catch (error) {
    throw handleApiError(error);
  }
};

export const withErrorHandling = (service) => {
  const wrappedService = {};
  
  for (const [key, method] of Object.entries(service)) {
    if (typeof method === 'function') {
      wrappedService[key] = createApiMethod(method);
    } else {
      wrappedService[key] = method;
    }
  }
  
  return wrappedService;
};

export const createQueryString = (params) => {
  if (!params) return '';
  
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      searchParams.append(key, value);
    }
  });
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
};

export const downloadFile = async (response, filename) => {
  const blob = new Blob([response.data]);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}; 