const pool = require('../db');

async function updateStoresTable() {
    try {
        // Check if description column exists
        const checkColumn = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'stores' AND column_name = 'description'
        `);

        if (checkColumn.rows.length === 0) {
            console.log('Adding description column to stores table...');
            
            // Add description column
            await pool.query(`
                ALTER TABLE stores 
                ADD COLUMN description TEXT
            `);

            console.log('Description column added successfully.');
        } else {
            console.log('Description column already exists.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error updating stores table:', error);
        process.exit(1);
    }
}

updateStoresTable(); 