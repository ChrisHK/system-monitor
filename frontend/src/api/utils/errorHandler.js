export class ApiError extends Error {
  constructor(message, status, code, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

export const handleApiError = (error) => {
  // Network errors (no response)
  if (!error.response) {
    throw new ApiError(
      'Network error occurred',
      0,
      ERROR_CODES.NETWORK_ERROR
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
        ERROR_CODES.UNAUTHORIZED
      );
    case 403:
      throw new ApiError(
        'Access forbidden',
        status,
        ERROR_CODES.FORBIDDEN
      );
    case 404:
      throw new ApiError(
        'Resource not found',
        status,
        ERROR_CODES.NOT_FOUND
      );
    case 500:
    case 502:
    case 503:
    case 504:
      throw new ApiError(
        'Server error occurred',
        status,
        ERROR_CODES.SERVER_ERROR,
        data
      );
    default:
      throw new ApiError(
        data?.error || 'Unknown error occurred',
        status,
        ERROR_CODES.UNKNOWN_ERROR,
        data
      );
  }
}; 