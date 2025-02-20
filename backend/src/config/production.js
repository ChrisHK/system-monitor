const defaultConfig = require('./default');

const productionConfig = {
  ...defaultConfig,
  // Override production specific settings here
  port: 80,
  sslEnabled: true,
  baseUrl: '/api',
  db: {
    ...defaultConfig.db,
    ssl: false,
    connectionTimeout: 5000,
    idleTimeout: 30000,
    maxConnections: 20
  },
  cors: {
    origin: [
      'https://erp.zerounique.com',
      'http://erp.zerounique.com',
      'https://api.erp.zerounique.com'
    ]
  }
};

module.exports = productionConfig; 