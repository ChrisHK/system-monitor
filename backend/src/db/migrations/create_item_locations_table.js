const pool = require('../index');

async function createItemLocationsTable() {
    const client = await pool.connect();
    
    try {
        console.log('Creating item_locations table...');
        
        await client.query('BEGIN');
        
        // Create item_locations table
        await client.query(`
            CREATE TABLE IF NOT EXISTS item_locations (
                id SERIAL PRIMARY KEY,
                serialnumber VARCHAR(100) NOT NULL UNIQUE,
                location VARCHAR(50) NOT NULL,
                store_id INTEGER REFERENCES stores(id),
                store_name VARCHAR(100),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create indexes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_item_locations_serialnumber ON item_locations(serialnumber);
            CREATE INDEX IF NOT EXISTS idx_item_locations_location ON item_locations(location);
            CREATE INDEX IF NOT EXISTS idx_item_locations_store_id ON item_locations(store_id)
        `);
        
        await client.query('COMMIT');
        
        console.log('Successfully created item_locations table');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating item_locations table:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run the migration
createItemLocationsTable().catch(console.error); 