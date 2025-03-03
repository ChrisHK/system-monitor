const defaultConfig = require('./default');

const developmentConfig = {
  ...defaultConfig,
  // Override development specific settings here
  port: 3000,
  host: '0.0.0.0',  // 允許所有網絡接口
  sslEnabled: false,
  db: {
    ...defaultConfig.db,
    ssl: false
  },
  cors: {
    origin: [
      'http://localhost:4001',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://192.168.0.10:3000',
      'http://192.168.0.10:3001',
      /^http:\/\/192\.168\.0\.\d+:(3000|3001)$/  // 允許 192.168.0.* 網段訪問
    ]
  }
};

module.exports = developmentConfig; 