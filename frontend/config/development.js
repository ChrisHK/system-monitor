const defaultConfig = require('./default');

const developmentConfig = {
  ...defaultConfig,
  // Override development specific settings here
  api: {
    ...defaultConfig.api,
    baseURL: 'http://localhost:3000',
    timeout: 5000
  },
  app: {
    ...defaultConfig.app,
    environment: 'development',
    port: 3001,
    host: 'localhost'
  },
  ws: {
    url: 'ws://localhost:3000/ws'
  }
};

module.exports = developmentConfig; 