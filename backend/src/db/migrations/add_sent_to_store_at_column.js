const { Pool } = require('pg');
const pool = new Pool();

async function updateRmaTables() {
    const client = await pool.connect();
    
    try {
        console.log('Starting migration: Adding sent_to_store_at column to store_rma table');
        
        await client.query('BEGIN');

        // Add sent_to_store_at column
        await client.query(`
            ALTER TABLE store_rma
            ADD COLUMN sent_to_store_at TIMESTAMP WITH TIME ZONE;
        `);

        await client.query('COMMIT');
        console.log('Migration completed successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Execute the migration
updateRmaTables().catch(console.error); 