module.exports = {
  // API Configuration
  api: {
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
    timeout: parseInt(process.env.REACT_APP_API_TIMEOUT || '5000')
  },

  // App Configuration
  app: {
    name: process.env.REACT_APP_NAME || 'System Monitor',
    version: process.env.REACT_APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },

  // Auth Configuration
  auth: {
    tokenKey: process.env.REACT_APP_TOKEN_KEY || 'auth_token',
    expiryKey: process.env.REACT_APP_TOKEN_EXPIRY_KEY || 'auth_token_expiry'
  },

  // WebSocket Configuration
  ws: {
    url: process.env.REACT_APP_WS_URL || 'ws://localhost:3000/ws'
  }
}; 