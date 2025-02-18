const defaultConfig = require('./default');

const developmentConfig = {
  ...defaultConfig,
  // Override development specific settings here
  port: 3000,
  sslEnabled: false,
  db: {
    ...defaultConfig.db,
    ssl: false
  },
  cors: {
    origin: ['http://localhost:4001', 'http://localhost:3000']
  }
};

module.exports = developmentConfig; 