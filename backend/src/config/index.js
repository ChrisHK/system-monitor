const path = require('path');

// 根據環境變量加載對應的配置文件
const env = process.env.NODE_ENV || 'development';
const envPath = path.join(__dirname, '..', '..', `.env.${env}`);

// 加載環境配置
require('dotenv').config({
  path: envPath
});

console.log(`Loading ${env} environment configuration from: ${envPath}`);

const configs = {
  development: require('./development'),
  production: require('./production')
};

const config = configs[env];
if (!config) {
  throw new Error(`No configuration found for environment: ${env}`);
}

module.exports = config; 