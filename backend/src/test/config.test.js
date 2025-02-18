const config = require('../config');

console.log('Testing backend configuration loading...');
console.log('----------------------------------------');

// Test environment
console.log('Environment:', config.nodeEnv);

// Test server configuration
console.log('\nServer Configuration:');
console.log('Port:', config.port);
console.log('Host:', config.host);
console.log('SSL Enabled:', config.sslEnabled);

// Test database configuration
console.log('\nDatabase Configuration:');
console.log('Host:', config.db.host);
console.log('Port:', config.db.port);
console.log('Database:', config.db.database);
console.log('SSL:', config.db.ssl);

// Test CORS configuration
console.log('\nCORS Configuration:');
console.log('Origins:', config.cors.origin);

// Test WebSocket configuration
console.log('\nWebSocket Configuration:');
console.log('Path:', config.ws.path);
console.log('Ping Interval:', config.ws.pingInterval);

// Test JWT configuration
console.log('\nJWT Configuration:');
console.log('Algorithm:', config.jwt.algorithm);
console.log('Expires In:', config.jwt.expiresIn);

// Test Passenger configuration
console.log('\nPassenger Configuration:');
console.log('App Env:', config.passenger.appEnv);
console.log('App Root:', config.passenger.appRoot); 