export class ApiError extends Error {
  constructor(message, status, code, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      code: this.code,
      data: this.data,
      timestamp: this.timestamp
    };
  }
}

export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  STORAGE_ERROR: 'STORAGE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  INVALID_STATE: 'INVALID_STATE',
  BUSINESS_ERROR: 'BUSINESS_ERROR'
};

export const handleApiError = (error) => {
  // Log error details
  console.error('API Error Details:', {
    error: error.toJSON ? error.toJSON() : error,
    timestamp: new Date().toISOString()
  });

  // Network errors (no response)
  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      throw new ApiError(
        'Request timeout',
        0,
        ERROR_CODES.TIMEOUT,
        { timeout: error.config?.timeout }
      );
    }
    throw new ApiError(
      'Network error occurred',
      0,
      ERROR_CODES.NETWORK_ERROR,
      { message: error.message }
    );
  }

  const { status, data } = error.response;
  
  // Common HTTP status codes
  switch (status) {
    case 400:
      throw new ApiError(
        data?.error || 'Bad Request',
        status,
        ERROR_CODES.VALIDATION_ERROR,
        data
      );
    case 401:
      throw new ApiError(
        'Unauthorized access',
        status,
        ERROR_CODES.UNAUTHORIZED,
        data
      );
    case 403:
      throw new ApiError(
        'Access forbidden',
        status,
        ERROR_CODES.FORBIDDEN,
        data
      );
    case 404:
      throw new ApiError(
        'Resource not found',
        status,
        ERROR_CODES.NOT_FOUND,
        data
      );
    case 409:
      throw new ApiError(
        data?.error || 'Conflict occurred',
        status,
        ERROR_CODES.INVALID_STATE,
        data
      );
    case 422:
      throw new ApiError(
        data?.error || 'Validation failed',
        status,
        ERROR_CODES.VALIDATION_ERROR,
        data
      );
    case 500:
      // Check for specific database errors
      if (data?.code?.startsWith('23') || data?.code?.startsWith('42')) {
        throw new ApiError(
          'Database error occurred',
          status,
          ERROR_CODES.DATABASE_ERROR,
          data
        );
      }
      throw new ApiError(
        'Server error occurred',
        status,
        ERROR_CODES.SERVER_ERROR,
        data
      );
    case 502:
    case 503:
    case 504:
      throw new ApiError(
        'Service temporarily unavailable',
        status,
        ERROR_CODES.SERVER_ERROR,
        data
      );
    default:
      // Check for business logic errors
      if (data?.code === 'BUSINESS_ERROR') {
        throw new ApiError(
          data.error || 'Business rule violation',
          status,
          ERROR_CODES.BUSINESS_ERROR,
          data
        );
      }
      throw new ApiError(
        data?.error || 'Unknown error occurred',
        status,
        ERROR_CODES.UNKNOWN_ERROR,
        data
      );
  }
};

export const withErrorHandling = (service) => {
  const handler = {
    get: (target, prop) => {
      const value = target[prop];
      
      if (typeof value === 'function') {
        return async (...args) => {
          try {
            const result = await value.apply(target, args);
            return result;
          } catch (error) {
            handleApiError(error);
          }
        };
      }
      
      return value;
    }
  };

  return new Proxy(service, handler);
}; 