const config = require('../../config');

console.log('Testing frontend configuration loading...');
console.log('----------------------------------------');

// Test API configuration
console.log('\nAPI Configuration:');
console.log('Base URL:', config.api.baseURL);
console.log('Timeout:', config.api.timeout);

// Test App configuration
console.log('\nApp Configuration:');
console.log('Name:', config.app.name);
console.log('Version:', config.app.version);
console.log('Environment:', config.app.environment);

// Test Auth configuration
console.log('\nAuth Configuration:');
console.log('Token Key:', config.auth.tokenKey);
console.log('Expiry Key:', config.auth.expiryKey);

// Test WebSocket configuration
console.log('\nWebSocket Configuration:');
console.log('URL:', config.ws.url); 