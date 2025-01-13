require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

async function addUniqueConstraint() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        console.log('Starting migration...');

        // Find and remove duplicate entries, keeping only the most recent one
        console.log('Cleaning up duplicate entries...');
        await client.query(`
            WITH duplicates AS (
                SELECT serialnumber,
                       id,
                       ROW_NUMBER() OVER (PARTITION BY serialnumber ORDER BY updated_at DESC) as rn
                FROM item_locations
            )
            DELETE FROM item_locations
            WHERE id IN (
                SELECT id
                FROM duplicates
                WHERE rn > 1
            );
        `);
        
        console.log('Adding unique constraint to item_locations table...');
        // Add the unique constraint
        await client.query(`
            ALTER TABLE item_locations
            ADD CONSTRAINT item_locations_serialnumber_key
            UNIQUE (serialnumber);
        `);
        
        await client.query('COMMIT');
        console.log('Successfully completed migration');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error during migration:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the migration
addUniqueConstraint()
    .then(() => {
        console.log('Migration completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Migration failed:', error);
        process.exit(1);
    }); 