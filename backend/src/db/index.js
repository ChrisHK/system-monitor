const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'system_monitor',
    password: process.env.PGPASSWORD || 'postgres',
    port: process.env.PGPORT || 5432,
});

// Test the database connection
pool.connect()
    .then(() => console.log('Successfully connected to database'))
    .catch(err => console.error('Error connecting to database:', err));

module.exports = pool; 