const { Pool } = require('pg');

const pool = new Pool({
    user: 'zero',
    host: '192.168.0.10',
    database: 'zerodb',
    password: 'zero',
    port: 5432,
});

async function listTables() {
    try {
        const client = await pool.connect();
        try {
            console.log('Listing all tables in database...');
            const query = `
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name;
            `;
            const result = await client.query(query);
            console.log('Tables found:');
            result.rows.forEach(row => {
                console.log('-', row.table_name);
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error listing tables:', error);
    } finally {
        await pool.end();
    }
}

listTables(); 