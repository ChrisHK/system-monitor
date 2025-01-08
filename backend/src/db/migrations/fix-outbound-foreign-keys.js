const { Pool } = require('pg');
const pool = new Pool({
    user: 'zero',
    host: 'localhost',
    database: 'zerodb',
    password: 'zero',
    port: 5432,
});

async function fixForeignKeys() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Drop existing tables
        await client.query('DROP TABLE IF EXISTS outbound_items CASCADE');
        await client.query('DROP TABLE IF EXISTS outbound CASCADE');

        // Recreate outbound table
        await client.query(`
            CREATE TABLE IF NOT EXISTS outbound (
                id SERIAL PRIMARY KEY,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP WITH TIME ZONE
            )
        `);

        // Recreate outbound_items table with correct foreign key reference
        await client.query(`
            CREATE TABLE IF NOT EXISTS outbound_items (
                id SERIAL PRIMARY KEY,
                outbound_id INTEGER REFERENCES outbound(id) ON DELETE CASCADE,
                record_id INTEGER REFERENCES system_records(id) ON DELETE CASCADE,
                added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(outbound_id, record_id)
            )
        `);

        await client.query('COMMIT');
        console.log('Successfully fixed foreign key constraints');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error fixing foreign key constraints:', err);
    } finally {
        client.release();
        pool.end();
    }
}

fixForeignKeys(); 