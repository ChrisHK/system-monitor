const { Pool } = require('pg');

const pool = new Pool({
    user: 'zero',
    host: '192.168.0.10',
    database: 'zerodb',
    password: 'zero',
    port: 5432,
});

async function checkCurrentData() {
    try {
        const client = await pool.connect();
        try {
            // Check system_records count
            console.log('Checking system_records data...');
            const countQuery = `
                SELECT COUNT(*) as total,
                       COUNT(*) FILTER (WHERE is_current = true) as current
                FROM system_records
            `;
            const countResult = await client.query(countQuery);
            console.log('Total records:', countResult.rows[0].total);
            console.log('Current records:', countResult.rows[0].current);

            // Check sample data
            console.log('\nSample records:');
            const sampleQuery = `
                SELECT id, serialnumber, computername, manufacturer, model, 
                       systemsku, operatingsystem, created_at, is_current
                FROM system_records
                WHERE is_current = true
                LIMIT 3
            `;
            const samples = await client.query(sampleQuery);
            console.log(samples.rows);

            // Check for duplicates
            console.log('\nChecking for duplicates...');
            const duplicatesQuery = `
                SELECT serialnumber, COUNT(*) as count
                FROM system_records
                WHERE serialnumber IS NOT NULL
                AND is_current = true
                GROUP BY serialnumber
                HAVING COUNT(*) > 1
                ORDER BY count DESC
                LIMIT 5
            `;
            const duplicates = await client.query(duplicatesQuery);
            if (duplicates.rows.length > 0) {
                console.log('Found duplicate serials:');
                console.log(duplicates.rows);
            } else {
                console.log('No duplicates found');
            }

        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error checking data:', error);
    } finally {
        await pool.end();
    }
}

checkCurrentData(); 