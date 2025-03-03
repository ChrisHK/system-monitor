const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '..', process.env.NODE_ENV === 'production' ? '.env.production' : '.env')
});

const env = process.env.NODE_ENV || 'development';
const configs = {
  development: require('./development'),
  production: require('./production')
};

const config = configs[env];
if (!config) {
  throw new Error(`No configuration found for environment: ${env}`);
}

module.exports = config; 