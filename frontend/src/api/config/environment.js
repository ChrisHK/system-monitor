// Required environment variables for the API
const REQUIRED_ENV_VARS = {
  development: [
    'REACT_APP_API_URL',
    'REACT_APP_WS_URL'
  ],
  production: [] // Production can use defaults safely
};

// Development configuration
const DEV_DEFAULTS = {
    REACT_APP_API_URL: 'http://192.168.0.10:3000/api',
    REACT_APP_WS_URL: 'ws://192.168.0.10:3000/ws',
    REACT_APP_API_TIMEOUT: '30000',
    ALLOWED_HOSTS: [
        'localhost:3000',
        'localhost:3001',
        '192.168.0.10:3000',
        '192.168.0.10:3001',
        '192.168.0.*:3000',
        '192.168.0.*:3001'
    ]
};

// Production configuration
const PROD_DEFAULTS = {
    REACT_APP_API_URL: '/api',
    REACT_APP_WS_URL: '',
    REACT_APP_API_TIMEOUT: '30000',
    ALLOWED_HOSTS: [
        'erp.zerounique.com'
    ]
};

// Get environment specific configuration
const getConfig = () => {
    const nodeEnv = process.env.NODE_ENV || 'development';
    const host = window.location.host;
    const protocol = window.location.protocol;
    const isSecure = protocol === 'https:';

    // In production, use relative paths and current host
    if (nodeEnv === 'production') {
        // Always use relative paths in production
        const config = {
            apiUrl: PROD_DEFAULTS.REACT_APP_API_URL,
            baseUrl: '',
            wsUrl: `${isSecure ? 'wss:' : 'ws:'}//${host}/ws`,
            apiTimeout: parseInt(process.env.REACT_APP_API_TIMEOUT || PROD_DEFAULTS.REACT_APP_API_TIMEOUT),
            isDevelopment: false,
            isProduction: true,
            host,
            protocol,
            isSecure,
            allowedHosts: PROD_DEFAULTS.ALLOWED_HOSTS,
            cspDirectives: {
                'default-src': ["'self'", `https://${host}`, `wss://${host}`],
                'connect-src': ["'self'", `https://${host}`, `wss://${host}`],
                'img-src': ["'self'", 'data:', 'blob:'],
                'style-src': ["'self'", "'unsafe-inline'"],
                'script-src': ["'self'"]
            }
        };

        // Log production configuration
        console.log('Production configuration:', {
            ...config,
            fullApiUrl: `${protocol}//${host}${config.apiUrl}`,
            timestamp: new Date().toISOString()
        });

        return config;
    }

    // In development, use environment variables or defaults
    const config = {
        apiUrl: process.env.REACT_APP_API_URL || DEV_DEFAULTS.REACT_APP_API_URL,
        baseUrl: '',
        wsUrl: process.env.REACT_APP_WS_URL || DEV_DEFAULTS.REACT_APP_WS_URL,
        apiTimeout: parseInt(process.env.REACT_APP_API_TIMEOUT || DEV_DEFAULTS.REACT_APP_API_TIMEOUT),
        isDevelopment: true,
        isProduction: false,
        host: window.location.hostname || 'localhost',
        protocol: window.location.protocol || 'http:',
        isSecure: false,
        allowedHosts: DEV_DEFAULTS.ALLOWED_HOSTS,
        cspDirectives: {
            'default-src': [
                "'self'", 
                'http://localhost:*', 
                'ws://localhost:*', 
                'http://192.168.0.*:*',
                'ws://192.168.0.*:*'
            ],
            'connect-src': [
                "'self'", 
                'http://localhost:*', 
                'ws://localhost:*', 
                'http://192.168.0.*:*',
                'ws://192.168.0.*:*'
            ],
            'img-src': ["'self'", 'data:', 'blob:'],
            'style-src': ["'self'", "'unsafe-inline'"],
            'script-src': ["'self'", "'unsafe-inline'"]
        }
    };

    // Log development configuration
    console.log('Development configuration:', {
        ...config,
        timestamp: new Date().toISOString()
    });

    return config;
};

// Validate environment variables
export const validateEnvironment = () => {
  const config = getConfig();
  
  console.log('Environment Configuration:', {
    NODE_ENV: process.env.NODE_ENV || 'development',
    API_URL: config.apiUrl,
    BASE_URL: config.baseUrl,
    WS_URL: config.wsUrl,
    API_TIMEOUT: config.apiTimeout,
    host: config.host,
    protocol: config.protocol,
    isSecure: config.isSecure,
    cspDirectives: config.cspDirectives,
    timestamp: new Date().toISOString()
  });

  return config;
};

// Get environment specific configuration
export const getEnvironmentConfig = () => {
  return getConfig();
}; 