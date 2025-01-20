const pool = require('../index');

async function addProcessedAtColumn() {
    const client = await pool.connect();
    
    try {
        console.log('Adding processed_at column to outbound_items table...');
        
        await client.query('BEGIN');
        
        // Add the processed_at column
        await client.query(`
            ALTER TABLE outbound_items
            ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP
        `);
        
        // Create an index on processed_at for better query performance
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_outbound_items_processed_at 
            ON outbound_items(processed_at)
        `);
        
        await client.query('COMMIT');
        
        console.log('Successfully added processed_at column');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding processed_at column:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Run the migration
addProcessedAtColumn().catch(console.error); 