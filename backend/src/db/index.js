const { Pool } = require('pg');
const path = require('path');

// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV === 'production' 
    ? path.join(__dirname, '../../.env.production')
    : path.join(__dirname, '../../.env');

require('dotenv').config({ path: envFile });

// Log environment state
console.log('Environment Configuration:', {
    NODE_ENV: process.env.NODE_ENV,
    envFile,
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    timestamp: new Date().toISOString()
});

// Validate required environment variables
const requiredEnvVars = ['DB_USER', 'DB_HOST', 'DB_NAME', 'DB_PASSWORD'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error('Missing required database environment variables:', {
        missing: missingEnvVars,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
    });
    process.exit(1);
}

// Database configuration
const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT || '5432'),
    // Connection pool settings
    max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
    maxUses: 7500,
    // Query settings
    statement_timeout: 10000,
    query_timeout: 10000,
    // Connection settings
    client_encoding: 'utf8'
};

// Create the connection pool
const pool = new Pool(dbConfig);

// Test database connection
async function testConnection() {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time, current_database() as database, current_user as user');
        
        console.log('Database connection successful:', {
            current_time: result.rows[0].current_time,
            database: result.rows[0].database,
            user: result.rows[0].user,
            host: dbConfig.host,
            timestamp: new Date().toISOString()
        });
        
        return true;
    } catch (err) {
        console.error('Database connection failed:', {
            error: err.message,
            code: err.code,
            host: dbConfig.host,
            database: dbConfig.database,
            user: dbConfig.user,
            timestamp: new Date().toISOString()
        });
        
        if (process.env.NODE_ENV === 'production') {
            console.error('Critical error: Database connection failed in production');
            process.exit(1);
        }
        return false;
    } finally {
        if (client) {
            try {
                await client.release();
            } catch (releaseErr) {
                console.error('Error releasing client:', {
                    error: releaseErr.message,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }
}

// Run connection test
testConnection();

// Pool event handlers
pool.on('error', (err) => {
    console.error('Unexpected database pool error:', {
        message: err.message,
        code: err.code,
        host: dbConfig.host,
        database: dbConfig.database,
        timestamp: new Date().toISOString()
    });
});

pool.on('connect', () => {
    console.log('New database connection established:', {
        timestamp: new Date().toISOString(),
        host: dbConfig.host,
        database: dbConfig.database,
        user: dbConfig.user
    });
});

// Query wrapper with logging
const query = async (text, params) => {
    const start = Date.now();
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(text, params);
        const duration = Date.now() - start;
        
        console.log('Query executed:', {
            text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            duration,
            rows: result.rowCount,
            timestamp: new Date().toISOString()
        });
        
        return result;
    } catch (err) {
        console.error('Query error:', {
            text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            error: err.message,
            code: err.code,
            params,
            timestamp: new Date().toISOString()
        });
        throw err;
    } finally {
        if (client) {
            try {
                await client.release();
            } catch (releaseErr) {
                console.error('Error releasing client:', {
                    error: releaseErr.message,
                    timestamp: new Date().toISOString()
                });
            }
        }
    }
};

module.exports = {
    query,
    pool
}; 