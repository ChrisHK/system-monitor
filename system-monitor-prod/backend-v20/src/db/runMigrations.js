require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./index');

async function runMigrations() {
    try {
        // Read the migration file
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'migrations', '004_create_outbound_tables.sql'),
            'utf8'
        );

        // Run the migration
        await pool.query(migrationSQL);
        console.log('Successfully ran migrations');
    } catch (err) {
        console.error('Error running migrations:', err);
    } finally {
        await pool.end();
    }
}

runMigrations(); 