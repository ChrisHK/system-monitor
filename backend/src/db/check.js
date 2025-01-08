const { Pool } = require('pg');

const pool = new Pool({
    user: 'zero',
    host: '192.168.0.10',
    database: 'zerodb',
    password: 'zero',
    port: 5432,
});

async function checkDatabase() {
    try {
        const client = await pool.connect();
        try {
            // Check tables
            console.log('Checking database tables...');
            const tablesQuery = `
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            `;
            const tables = await client.query(tablesQuery);
            console.log('Tables in database:', tables.rows.map(r => r.table_name));

            // Check records data
            console.log('\nChecking records data...');
            const recordsQuery = `
                SELECT COUNT(*) as count 
                FROM records
            `;
            const records = await client.query(recordsQuery);
            console.log('Number of records:', records.rows[0].count);

            // Show sample records
            if (records.rows[0].count > 0) {
                const sampleQuery = `
                    SELECT * FROM records LIMIT 3
                `;
                const samples = await client.query(sampleQuery);
                console.log('\nSample records:');
                console.log(samples.rows);
            }

            // Check system_records data
            console.log('\nChecking system_records data...');
            const sysRecordsQuery = `
                SELECT COUNT(*) as count 
                FROM system_records
            `;
            const sysRecords = await client.query(sysRecordsQuery);
            console.log('Number of system records:', sysRecords.rows[0].count);

            // Show sample system_records
            if (sysRecords.rows[0].count > 0) {
                const sampleSysQuery = `
                    SELECT * FROM system_records LIMIT 3
                `;
                const sysSamples = await client.query(sampleSysQuery);
                console.log('\nSample system_records:');
                console.log(sysSamples.rows);
            }

        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error checking database:', error);
    } finally {
        await pool.end();
    }
}

checkDatabase(); 