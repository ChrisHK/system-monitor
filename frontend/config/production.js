const defaultConfig = require('./default');

const productionConfig = {
  ...defaultConfig,
  // Override production specific settings here
  api: {
    ...defaultConfig.api,
    baseURL: '/api',
    timeout: 10000
  },
  app: {
    ...defaultConfig.app,
    environment: 'production',
    port: 80,
    basePath: '/',
    host: 'localhost'
  },
  ws: {
    url: 'ws://localhost/api/ws'
  }
};

module.exports = productionConfig; 