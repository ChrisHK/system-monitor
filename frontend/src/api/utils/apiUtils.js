import { handleApiError } from './errorHandler';

export const createApiMethod = (apiCall) => async (...args) => {
  try {
    const startTime = Date.now();
    const result = await apiCall(...args);
    const endTime = Date.now();

    // Log successful API call
    console.log('API Call Success:', {
      method: apiCall.name,
      duration: endTime - startTime,
      args,
      timestamp: new Date().toISOString()
    });

    return result;
  } catch (error) {
    // Log failed API call
    console.error('API Call Failed:', {
      method: apiCall.name,
      error: error.message,
      args,
      timestamp: new Date().toISOString()
    });

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
  
  try {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(`${key}[]`, v));
        } else if (typeof value === 'object') {
          searchParams.append(key, JSON.stringify(value));
        } else {
          searchParams.append(key, value);
        }
      }
    });
    
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : '';
  } catch (error) {
    console.error('Error creating query string:', {
      params,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    return '';
  }
};

export const downloadFile = async (response, filename) => {
  try {
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    console.log('File download successful:', {
      filename,
      size: blob.size,
      type: blob.type,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error downloading file:', {
      filename,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw new Error('Failed to download file');
  }
};

export const formatApiError = (error) => {
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unknown error occurred';
};

export const isNetworkError = (error) => {
  return !error.response && (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED');
};

export const isAuthError = (error) => {
  return error.response?.status === 401;
};

export const isValidationError = (error) => {
  return error.response?.status === 400 || error.response?.status === 422;
};

export const getValidationErrors = (error) => {
  if (!isValidationError(error)) {
    return {};
  }
  return error.response?.data?.errors || {};
};

export const retryWithBackoff = async (fn, retries = 3, backoff = 300) => {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0 || !isNetworkError(error)) {
      throw error;
    }

    console.log('Retrying failed request:', {
      retriesLeft: retries - 1,
      backoff,
      error: error.message,
      timestamp: new Date().toISOString()
    });

    await new Promise(resolve => setTimeout(resolve, backoff));
    return retryWithBackoff(fn, retries - 1, backoff * 2);
  }
}; 