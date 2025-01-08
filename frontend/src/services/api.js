// Use the environment variable for API URL
const API_BASE_URL = (() => {
    // Get the current hostname
    const currentHostname = window.location.hostname;
    const apiUrl = process.env.REACT_APP_API_URL;
    
    // If accessing from another machine, ensure we use the server's IP
    if (currentHostname !== 'localhost' && currentHostname !== '127.0.0.1') {
        return 'http://192.168.0.10:3000/api';
    }
    
    return apiUrl || 'http://192.168.0.10:3000/api';
})();

// Log all environment variables and connection info for debugging
console.log('API Configuration:', {
    currentHostname: window.location.hostname,
    REACT_APP_API_URL: process.env.REACT_APP_API_URL,
    REACT_APP_WS_URL: process.env.REACT_APP_WS_URL,
    NODE_ENV: process.env.NODE_ENV,
    API_BASE_URL,
    origin: window.location.origin
});

const defaultOptions = {
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    mode: 'cors'
};

export const fetchRecords = async (page = 1) => {
    try {
        const url = `${API_BASE_URL}/records?page=${page}`;
        console.log('Fetching records from:', url);

        const response = await fetch(url, {
            ...defaultOptions,
            method: 'GET',
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Fetched records:', data);
        return data;
    } catch (error) {
        console.error('Error fetching records:', error);
        throw error;
    }
};

export const searchRecords = async (field, term) => {
    try {
        const url = `${API_BASE_URL}/records/search?field=${encodeURIComponent(field)}&term=${encodeURIComponent(term)}`;
        console.log('Searching records:', { url, field, term });
        
        const response = await fetch(url, {
            ...defaultOptions,
            method: 'GET',
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Search results:', data);
        return data;
    } catch (error) {
        console.error('Error searching records:', error);
        throw error;
    }
};

// Add outbound-related API functions
export const addToOutbound = async (recordId) => {
    try {
        const response = await fetch(`${API_BASE_URL}/outbound/items`, {
            ...defaultOptions,
            method: 'POST',
            body: JSON.stringify({ recordId })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error adding to outbound:', error);
        throw error;
    }
};

export const getOutboundItems = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/outbound/items`, {
            ...defaultOptions,
            method: 'GET'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching outbound items:', error);
        throw error;
    }
};

export const removeFromOutbound = async (recordId) => {
    try {
        const response = await fetch(`${API_BASE_URL}/outbound/items/${recordId}`, {
            ...defaultOptions,
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error removing from outbound:', error);
        throw error;
    }
};

export const confirmOutbound = async (outboundId, notes) => {
    try {
        const response = await fetch(`${API_BASE_URL}/outbound/${outboundId}/confirm`, {
            ...defaultOptions,
            method: 'POST',
            body: JSON.stringify({ notes })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error confirming outbound:', error);
        throw error;
    }
};

export const searchOutboundRecords = async (field, term) => {
    try {
        const url = `${API_BASE_URL}/outbound/search?field=${encodeURIComponent(field)}&term=${encodeURIComponent(term)}`;
        console.log('Searching outbound records:', { url, field, term });
        
        const response = await fetch(url, {
            ...defaultOptions,
            method: 'GET',
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Outbound search results:', data);
        return data;
    } catch (error) {
        console.error('Error searching outbound records:', error);
        throw error;
    }
};

// Store-related API functions
export const getStores = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/stores`, {
            ...defaultOptions,
            method: 'GET'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching stores:', error);
        throw error;
    }
};

export const getStoreItems = async (storeId) => {
    try {
        const response = await fetch(`${API_BASE_URL}/stores/${storeId}/items`, {
            ...defaultOptions,
            method: 'GET'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching store items:', error);
        throw error;
    }
};

export const sendToStore = async (storeId, items) => {
    try {
        const response = await fetch(`${API_BASE_URL}/stores/${storeId}/outbound`, {
            ...defaultOptions,
            method: 'POST',
            headers: {
                ...defaultOptions.headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ items: items })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error sending items to store:', error);
        throw error;
    }
};

export const deleteStoreItem = async (storeId, itemId) => {
    try {
        const response = await fetch(`${API_BASE_URL}/stores/${storeId}/items/${itemId}`, {
            ...defaultOptions,
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error deleting store item:', error);
        throw error;
    }
};

export const exportStoreItems = async (storeId) => {
    try {
        const response = await fetch(`${API_BASE_URL}/stores/${storeId}/export`, {
            ...defaultOptions,
            method: 'GET'
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.text(); // Return as text for CSV
    } catch (error) {
        console.error('Error exporting store items:', error);
        throw error;
    }
};

export const checkStoreItems = async (storeId, items) => {
    try {
        const response = await fetch(`${API_BASE_URL}/stores/${storeId}/check-items`, {
            ...defaultOptions,
            method: 'POST',
            headers: {
                ...defaultOptions.headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ items })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error checking store items:', error);
        throw error;
    }
}; 