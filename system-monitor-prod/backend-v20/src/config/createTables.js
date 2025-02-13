require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const createTables = async () => {
    try {
        // Create outbound table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS outbound (
                id SERIAL PRIMARY KEY,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP WITH TIME ZONE,
                notes TEXT
            )
        `);
        console.log('Created outbound table');

        // Create outbound_items table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS outbound_items (
                id SERIAL PRIMARY KEY,
                outbound_id INTEGER REFERENCES outbound(id) ON DELETE CASCADE,
                record_id INTEGER REFERENCES system_records(id) ON DELETE CASCADE,
                added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(outbound_id, record_id)
            )
        `);
        console.log('Created outbound_items table');

        console.log('All tables created successfully');
    } catch (error) {
        console.error('Error creating tables:', error);
    } finally {
        await pool.end();
    }
};

createTables(); 