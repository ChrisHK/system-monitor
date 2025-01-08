const pool = require('../db');

async function updateSchema() {
    try {
        console.log('Updating stores table schema...');
        
        // Begin transaction
        await pool.query('BEGIN');

        // Create temporary table
        await pool.query(`
            CREATE TABLE stores_new (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                address TEXT NOT NULL,
                phone VARCHAR(20) NOT NULL,
                email VARCHAR(100) NOT NULL,
                description TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Copy data from old table to new table
        await pool.query(`
            INSERT INTO stores_new (id, name, address, phone, email, description)
            SELECT id, name, address, phone, email, description
            FROM stores
        `);

        // Drop old table and rename new table
        await pool.query('DROP TABLE stores CASCADE');
        await pool.query('ALTER TABLE stores_new RENAME TO stores');

        // Recreate foreign key constraints
        await pool.query(`
            ALTER TABLE store_items 
            ADD CONSTRAINT store_items_store_id_fkey 
            FOREIGN KEY (store_id) REFERENCES stores(id)
        `);

        // Commit transaction
        await pool.query('COMMIT');
        
        console.log('Schema update completed successfully');
        process.exit(0);
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Error updating schema:', error);
        process.exit(1);
    }
}

updateSchema(); 