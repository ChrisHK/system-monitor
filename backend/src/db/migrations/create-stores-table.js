const { Pool } = require('pg');
const pool = new Pool({
    user: 'zero',
    host: 'localhost',
    database: 'zerodb',
    password: 'zero',
    port: 5432,
});

async function createStoresTable() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Create stores table
        await client.query(`
            CREATE TABLE IF NOT EXISTS stores (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                address TEXT,
                phone VARCHAR(50),
                contact_person VARCHAR(255),
                email VARCHAR(255),
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add indexes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_stores_name ON stores(name);
            CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);
        `);

        await client.query('COMMIT');
        console.log('Successfully created stores table');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating stores table:', err);
    } finally {
        client.release();
        pool.end();
    }
}

createStoresTable(); 