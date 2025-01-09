const pool = require('../db');

async function checkStores() {
    try {
        console.log('Checking stores table...');
        
        // Check table structure
        const tableInfo = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'stores'
            ORDER BY ordinal_position;
        `);
        
        console.log('\nTable structure:');
        console.table(tableInfo.rows);

        // Check store data
        const stores = await pool.query('SELECT * FROM stores ORDER BY name');
        
        console.log('\nStore data:');
        console.table(stores.rows);
        
        console.log(`\nTotal stores: ${stores.rows.length}`);

        process.exit(0);
    } catch (error) {
        console.error('Error checking stores:', error);
        process.exit(1);
    }
}

checkStores(); 