// Server configuration
export const SERVER_CONFIG = {
    getBaseUrl: () => {
        const configuredUrl = process.env.REACT_APP_API_URL;
        if (configuredUrl) {
            // Remove protocol and /api from the URL
            return configuredUrl.replace(/(^\w+:|^)\/\//, '').replace('/api', '');
        }
        return 'localhost:4000';
    },
    
    getApiUrl: () => {
        return process.env.REACT_APP_API_URL || 'http://localhost:4000/api';
    },
    
    getWsUrl: () => {
        return process.env.REACT_APP_WS_URL || 'ws://localhost:4000/ws';
    }
}; 