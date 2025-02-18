const defaultConfig = require('./default');

const productionConfig = {
  ...defaultConfig,
  // Override production specific settings here
  port: 80,
  sslEnabled: true,
  baseUrl: '/api',
  db: {
    user: 'zerouniq_admin',
    password: 'is-Admin',
    host: '127.0.0.200',
    database: 'zerouniq_db',
    port: 5432,
    ssl: false,
    connectionTimeout: 5000,
    idleTimeout: 30000,
    maxConnections: 20
  },
  cors: {
    origin: ['http://localhost', 'https://localhost']
  }
};

module.exports = productionConfig; 