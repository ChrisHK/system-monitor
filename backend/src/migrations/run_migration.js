require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

async function runMigration() {
    const client = await pool.connect();
    try {
        // Read and execute the migration SQL file
        const sqlPath = path.join(__dirname, 'remove_is_deleted_from_order_items.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('Starting migration to remove is_deleted...');
        await client.query('BEGIN');
        
        // Split and execute each statement separately
        const statements = sql.split(';').filter(stmt => stmt.trim());
        for (const statement of statements) {
            if (statement.trim()) {
                console.log('Executing:', statement.trim());
                await client.query(statement);
            }
        }
        
        await client.query('COMMIT');
        console.log('Migration completed successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

runMigration().catch(console.error); 