// Get server configuration based on environment
const getServerConfig = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const protocol = window.location.protocol;
  const host = window.location.host;
  const isProduction = nodeEnv === 'production';

  // Log configuration
  console.log('Server Configuration:', {
    environment: nodeEnv,
    protocol,
    host,
    isProduction,
    timestamp: new Date().toISOString()
  });

  // In production, use current host
  if (isProduction) {
    return {
      host,
      protocol,
      apiPath: '/api',
      wsPath: '/ws'
    };
  }

  // In development, use environment variables or defaults
  return {
    host: process.env.REACT_APP_SERVER_HOST || 'localhost:3000',
    protocol: process.env.REACT_APP_SERVER_PROTOCOL || 'http:',
    apiPath: process.env.REACT_APP_API_PATH || '/api',
    wsPath: process.env.REACT_APP_WS_PATH || '/ws'
  };
};

export default getServerConfig; 