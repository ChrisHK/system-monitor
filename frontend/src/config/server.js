// Server configuration
export const SERVER_CONFIG = {
    getBaseUrl: () => {
        const currentHostname = window.location.hostname;
        const configuredHost = process.env.REACT_APP_API_HOST;
        const configuredPort = process.env.REACT_APP_API_PORT || '4000';
        
        // Always use the configured host if available
        if (configuredHost) {
            return `${configuredHost}:${configuredPort}`;
        }
        
        // Fallback to IP for non-localhost
        if (currentHostname !== 'localhost' && currentHostname !== '127.0.0.1') {
            return '192.168.0.10:4000';
        }
        
        return 'localhost:4000';
    },
    
    getApiUrl: () => {
        const baseUrl = SERVER_CONFIG.getBaseUrl();
        return `http://${baseUrl}/api`;
    },
    
    getWsUrl: () => {
        const baseUrl = SERVER_CONFIG.getBaseUrl();
        return `ws://${baseUrl}/ws`;
    }
}; 