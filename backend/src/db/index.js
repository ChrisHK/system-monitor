const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    max: 20, // 最大連接數
    idleTimeoutMillis: 30000, // 空閒超時
    connectionTimeoutMillis: 2000, // 連接超時
    maxUses: 7500, // 每個連接最大使用次數
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Database connected successfully');
    release();
});

// Add event listeners for pool error handling
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

pool.on('connect', () => {
    console.log('Connected to database');
});

pool.on('remove', (client) => {
    console.log('Client removed from pool');
});

module.exports = pool; 