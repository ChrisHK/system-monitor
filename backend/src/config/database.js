require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: process.env.DB_SSL === 'true',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Enhanced error handling
pool.on('connect', () => {
    console.log('Database connected successfully');
});

pool.on('error', (err, client) => {
    console.error('Unexpected database error:', err);
    // Implement error notification/monitoring here
});

// Add connection testing method
const testConnection = async () => {
    let client;
    try {
        client = await pool.connect();
        await client.query('SELECT NOW()');
        return true;
    } catch (err) {
        console.error('Database connection test failed:', err);
        return false;
    } finally {
        if (client) client.release();
    }
};

module.exports = { pool, testConnection }; 