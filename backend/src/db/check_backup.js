const { Pool } = require('pg');

const pool = new Pool({
    user: 'zero',
    host: '192.168.0.10',
    database: 'zerodb',
    password: 'zero',
    port: 5432,
});

async function checkBackup() {
    try {
        const client = await pool.connect();
        try {
            // Check backup count
            console.log('Checking backup data...');
            const countQuery = `
                SELECT 
                    COUNT(*) as total,
                    COUNT(DISTINCT original_id) as unique_originals,
                    MIN(backup_date) as earliest_backup,
                    MAX(backup_date) as latest_backup
                FROM system_records_backup
            `;
            const countResult = await client.query(countQuery);
            console.log('Backup statistics:', countResult.rows[0]);

            // Check sample backup data
            console.log('\nSample backup records:');
            const sampleQuery = `
                SELECT 
                    id, original_id, serialnumber, computername,
                    created_at, updated_at, is_current, backup_date
                FROM system_records_backup
                ORDER BY backup_date DESC
                LIMIT 3
            `;
            const samples = await client.query(sampleQuery);
            console.log(samples.rows);

            // Verify data consistency
            console.log('\nVerifying data consistency...');
            const verifyQuery = `
                SELECT 
                    COUNT(*) as match_count
                FROM system_records_backup b
                JOIN system_records r ON b.original_id = r.id
                WHERE b.serialnumber = r.serialnumber
                AND b.computername = r.computername
                AND b.created_at = r.created_at
            `;
            const verify = await client.query(verifyQuery);
            console.log('Matching records:', verify.rows[0].match_count);

        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error checking backup:', error);
    } finally {
        await pool.end();
    }
}

checkBackup(); 