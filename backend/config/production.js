const defaultConfig = require('./default');

const productionConfig = {
  ...defaultConfig,
  // Override production specific settings here
  port: 80,
  sslEnabled: true,
  db: {
    ...defaultConfig.db,
    ssl: false,  // Production specific SSL setting
    connectionTimeout: 5000,
    idleTimeout: 30000,
    maxConnections: 20
  },
  cors: {
    origin: ['https://erp.zerounique.com', 'http://erp.zerounique.com', 'https://api.erp.zerounique.com']
  }
};

module.exports = productionConfig; 