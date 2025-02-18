module.exports = {
  // Server Configuration
  port: process.env.PORT || 3000,
  host: process.env.HOST || 'localhost',
  nodeEnv: process.env.NODE_ENV || 'development',
  sslEnabled: process.env.SSL_ENABLED === 'true',

  // Database Configuration
  db: {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: process.env.DB_SSL === 'true',
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20')
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000']
  },

  // WebSocket Configuration
  ws: {
    path: process.env.WS_PATH || '/ws',
    pingInterval: parseInt(process.env.WS_PING_INTERVAL || '30000')
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'development_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    algorithm: process.env.JWT_ALGORITHM || 'HS256'
  },

  // Passenger Configuration
  passenger: {
    appEnv: process.env.PASSENGER_APP_ENV || 'development',
    appRoot: process.env.PASSENGER_APP_ROOT || process.cwd()
  }
}; 