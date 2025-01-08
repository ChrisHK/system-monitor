const { Pool } = require('pg');

const pool = new Pool({
    user: 'zero',
    host: '192.168.0.10',
    database: 'zerodb',
    password: 'zero',
    port: 5432,
});

async function verifyDuplicates() {
    try {
        const client = await pool.connect();
        try {
            // Check current records count
            console.log('Checking current records...');
            const currentQuery = `
                SELECT COUNT(*) as count
                FROM system_records
                WHERE is_current = true
            `;
            const currentResult = await client.query(currentQuery);
            console.log('Current records:', currentResult.rows[0].count);

            // Check for any remaining duplicates
            console.log('\nChecking for remaining duplicates...');
            const duplicatesQuery = `
                SELECT serialnumber, COUNT(*) as count
                FROM system_records
                WHERE serialnumber IS NOT NULL
                AND is_current = true
                GROUP BY serialnumber
                HAVING COUNT(*) > 1
                ORDER BY count DESC
            `;
            const duplicates = await client.query(duplicatesQuery);
            if (duplicates.rows.length > 0) {
                console.log('Found remaining duplicates:');
                duplicates.rows.forEach(dup => {
                    console.log(`- ${dup.serialnumber}: ${dup.count} records`);
                });
            } else {
                console.log('No duplicates found among current records');
            }

            // Check records marked as not current
            console.log('\nChecking records marked as not current...');
            const notCurrentQuery = `
                SELECT 
                    serialnumber,
                    COUNT(*) as count,
                    MAX(created_at) as latest_date,
                    MIN(created_at) as earliest_date
                FROM system_records
                WHERE is_current = false
                GROUP BY serialnumber
                ORDER BY count DESC
                LIMIT 5
            `;
            const notCurrent = await client.query(notCurrentQuery);
            console.log('Sample of records marked as not current:');
            notCurrent.rows.forEach(rec => {
                console.log(`- ${rec.serialnumber}:`, {
                    count: rec.count,
                    date_range: `${rec.earliest_date} to ${rec.latest_date}`
                });
            });

        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error verifying duplicates:', error);
    } finally {
        await pool.end();
    }
}

verifyDuplicates(); 