const { Pool } = require('pg');
const pool = require('../../config/database');

async function createLocationsTable() {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Create the locations table
        await client.query(`
            CREATE TABLE IF NOT EXISTS item_locations (
                id SERIAL PRIMARY KEY,
                serialnumber VARCHAR(255) NOT NULL,
                location VARCHAR(50) NOT NULL,
                store_id INTEGER REFERENCES stores(id),
                store_name VARCHAR(255),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_latest_location UNIQUE (serialnumber, updated_at)
            );
            
            CREATE INDEX IF NOT EXISTS idx_locations_serialnumber 
            ON item_locations(serialnumber);
            
            CREATE INDEX IF NOT EXISTS idx_locations_updated 
            ON item_locations(updated_at DESC);
        `);

        await client.query('COMMIT');
        console.log('Locations table created successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating locations table:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run the migration
createLocationsTable().catch(console.error); 