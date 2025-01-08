const { Pool } = require('pg');

const pool = new Pool({
    user: 'zero',
    host: '192.168.0.10',
    database: 'zerodb',
    password: 'zero',
    port: 5432,
});

async function checkAllTables() {
    try {
        const client = await pool.connect();
        try {
            // Get all tables
            const tablesQuery = `
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
                ORDER BY table_name;
            `;
            const tables = await client.query(tablesQuery);
            console.log('Tables in database:', tables.rows.map(r => r.table_name));

            // Check each table's count and sample data
            for (const table of tables.rows) {
                const tableName = table.table_name;
                console.log(`\n=== Checking ${tableName} ===`);

                // Get count
                const countQuery = `SELECT COUNT(*) as count FROM ${tableName}`;
                const count = await client.query(countQuery);
                console.log(`Number of rows: ${count.rows[0].count}`);

                // Get structure
                const structureQuery = `
                    SELECT column_name, data_type
                    FROM information_schema.columns
                    WHERE table_name = $1
                    ORDER BY ordinal_position;
                `;
                const structure = await client.query(structureQuery, [tableName]);
                console.log('\nTable structure:');
                console.log(structure.rows);

                // Get sample data if table has rows
                if (count.rows[0].count > 0) {
                    const sampleQuery = `SELECT * FROM ${tableName} LIMIT 2`;
                    const samples = await client.query(sampleQuery);
                    console.log('\nSample data:');
                    console.log(samples.rows);
                }
            }

        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error checking tables:', error);
    } finally {
        await pool.end();
    }
}

checkAllTables(); 