// Add retry utility function
export const fetchWithRetry = async (fn, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
    }
};

// Custom API Error class
export class ApiError extends Error {
    constructor(message, originalError) {
        super(message);
        this.name = 'ApiError';
        this.originalError = originalError;
        this.timestamp = new Date();
    }
}

// Validation Error class
export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

// RMA Status Flow definition
export const RMA_STATUS_FLOW = {
    // Store statuses
    'pending': ['sent_to_inventory'],
    'sent_to_inventory': [],
    'sent_to_store': [],
    'completed': [],
    'failed': [],

    // Inventory statuses
    'receive': ['process', 'failed'],
    'process': ['complete', 'failed'],
    'complete': ['sent_to_store'],
    'failed': []
};

// Validation functions
export const validateRmaData = (data) => {
    const required = ['recordId', 'reason'];
    for (const field of required) {
        if (!data[field]) {
            throw new ValidationError(`Missing required field: ${field}`);
        }
    }
};

export const validateStatusTransition = (currentStatus, newStatus) => {
    const allowedTransitions = RMA_STATUS_FLOW[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
        throw new ValidationError(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
};

// API wrapper for consistent error handling
export const createApiWrapper = (apiCall) => async (...args) => {
    try {
        const response = await fetchWithRetry(async () => {
            const result = await apiCall(...args);
            if (!result.success) {
                throw new Error(result.error || 'Operation failed');
            }
            return result;
        });
        return response;
    } catch (error) {
        console.error(`API Error: ${error.message}`, error);
        throw new ApiError(error.message, error);
    }
}; 