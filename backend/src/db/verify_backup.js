const { Pool } = require('pg');

const pool = new Pool({
    user: 'zero',
    host: '192.168.0.10',
    database: 'zerodb',
    password: 'zero',
    port: 5432,
});

async function verifyBackup() {
    try {
        const client = await pool.connect();
        try {
            // Compare record counts
            console.log('Comparing record counts...');
            const countQuery = `
                SELECT 
                    (SELECT COUNT(*) FROM system_records) as source_count,
                    (SELECT COUNT(*) FROM system_records_backup) as backup_count
            `;
            const countResult = await client.query(countQuery);
            const counts = countResult.rows[0];
            console.log('Source records:', counts.source_count);
            console.log('Backup records:', counts.backup_count);

            // Compare sample records
            console.log('\nComparing sample records...');
            const sampleQuery = `
                WITH sample_records AS (
                    SELECT id, serialnumber, computername, created_at
                    FROM system_records
                    ORDER BY RANDOM()
                    LIMIT 3
                )
                SELECT 
                    s.id as source_id,
                    s.serialnumber as source_serial,
                    s.computername as source_computer,
                    b.original_id as backup_original_id,
                    b.serialnumber as backup_serial,
                    b.computername as backup_computer
                FROM sample_records s
                LEFT JOIN system_records_backup b ON s.id = b.original_id
            `;
            const samples = await client.query(sampleQuery);
            samples.rows.forEach((row, i) => {
                console.log(`\nSample ${i + 1}:`);
                console.log('Source:', {
                    id: row.source_id,
                    serial: row.source_serial,
                    computer: row.source_computer
                });
                console.log('Backup:', {
                    original_id: row.backup_original_id,
                    serial: row.backup_serial,
                    computer: row.backup_computer
                });
            });

            // Check for any mismatches
            console.log('\nChecking for mismatches...');
            const mismatchQuery = `
                SELECT COUNT(*) as mismatch_count
                FROM system_records s
                LEFT JOIN system_records_backup b ON s.id = b.original_id
                WHERE s.serialnumber != b.serialnumber
                OR s.computername != b.computername
                OR s.created_at != b.created_at
            `;
            const mismatchResult = await client.query(mismatchQuery);
            console.log('Number of mismatches:', mismatchResult.rows[0].mismatch_count);

        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error verifying backup:', error);
    } finally {
        await pool.end();
    }
}

verifyBackup(); 