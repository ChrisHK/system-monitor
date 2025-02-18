const defaultConfig = require('./default');

const developmentConfig = {
  ...defaultConfig,
  // Override development specific settings here
  port: 3000,
  sslEnabled: false,
  db: {
    user: 'zero',
    password: 'zero',
    host: 'localhost',
    database: 'zerodev',
    port: 5432,
    ssl: false,
    connectionTimeout: 5000,
    idleTimeout: 30000,
    maxConnections: 10
  },
  cors: {
    origin: ['http://localhost:3001', 'http://localhost:3000']
  }
};

module.exports = developmentConfig; 