const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'zero',
    host: process.env.DB_HOST || '192.168.0.10',
    database: process.env.DB_NAME || 'zerodb',
    password: process.env.DB_PASSWORD || 'zero',
    port: process.env.DB_PORT || 5432,
});

// Test the connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Database connected successfully');
    }
});

// Error handling
pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
});

module.exports = pool; 