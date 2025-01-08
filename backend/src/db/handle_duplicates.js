const { Pool } = require('pg');

const pool = new Pool({
    user: 'zero',
    host: '192.168.0.10',
    database: 'zerodb',
    password: 'zero',
    port: 5432,
});

async function handleDuplicates() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Find all duplicate serial numbers
        console.log('Finding duplicate serial numbers...');
        const findDuplicatesQuery = `
            SELECT serialnumber, COUNT(*) as count
            FROM system_records
            WHERE serialnumber IS NOT NULL
            AND is_current = true
            GROUP BY serialnumber
            HAVING COUNT(*) > 1
            ORDER BY count DESC
        `;
        const duplicates = await client.query(findDuplicatesQuery);
        console.log(`Found ${duplicates.rows.length} serial numbers with duplicates`);

        // For each duplicate serial number, keep only the most recent record
        let totalUpdated = 0;
        for (const dup of duplicates.rows) {
            const serialNumber = dup.serialnumber;
            console.log(`\nProcessing ${serialNumber} (${dup.count} records)...`);

            // Find all records for this serial number
            const recordsQuery = `
                SELECT id, serialnumber, computername, created_at
                FROM system_records
                WHERE serialnumber = $1
                AND is_current = true
                ORDER BY created_at DESC
            `;
            const records = await client.query(recordsQuery, [serialNumber]);

            // Keep the most recent record, mark others as not current
            const keepId = records.rows[0].id;
            const updateQuery = `
                UPDATE system_records
                SET is_current = false
                WHERE serialnumber = $1
                AND id != $2
                AND is_current = true
                RETURNING id
            `;
            const updateResult = await client.query(updateQuery, [serialNumber, keepId]);
            
            console.log(`Kept record ${keepId} (newest)`);
            console.log(`Marked ${updateResult.rowCount} older records as not current`);
            totalUpdated += updateResult.rowCount;
        }

        await client.query('COMMIT');
        console.log(`\nCompleted processing duplicates:`);
        console.log(`- Found ${duplicates.rows.length} duplicate serial numbers`);
        console.log(`- Updated ${totalUpdated} records to not current`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error handling duplicates:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

handleDuplicates(); 