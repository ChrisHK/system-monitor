const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    user: 'zero',
    host: '192.168.0.10',
    database: 'zerodb',
    password: 'zero',
    port: 5432,
});

async function setupDatabase() {
    try {
        // Read the schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Connect to database
        const client = await pool.connect();
        
        try {
            // Execute schema
            await client.query(schema);
            console.log('Database schema created successfully');
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error setting up database:', error);
    } finally {
        await pool.end();
    }
}

setupDatabase(); 