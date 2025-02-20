const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

const pool = new Pool({
    user: process.env.DB_USER || 'zero',
    host: process.env.DB_HOST || '192.168.0.10',
    database: process.env.DB_NAME || 'zerodb',
    password: process.env.DB_PASSWORD || 'zero',
    port: parseInt(process.env.DB_PORT || '5432'),
});

async function runMigration() {
    const client = await pool.connect();
    try {
        const sql = await fs.readFile(
            path.join(__dirname, 'migrations', '20240219_002_update_system_records.sql'),
            'utf8'
        );
        await client.query(sql);
        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration(); 