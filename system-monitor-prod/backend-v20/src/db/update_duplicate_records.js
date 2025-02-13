const pool = require('../db');

async function updateDuplicateRecords() {
    const client = await pool.connect();
    try {
        console.log('Starting duplicate records update...');
        
        await client.query('BEGIN');

        // Find all duplicate serial numbers
        const duplicatesQuery = `
            SELECT serialnumber
            FROM system_records
            GROUP BY serialnumber
            HAVING COUNT(*) > 1
        `;
        
        const duplicates = await client.query(duplicatesQuery);
        console.log(`Found ${duplicates.rows.length} duplicate serial numbers`);

        // For each duplicate serial number
        for (const dup of duplicates.rows) {
            const serialNumber = dup.serialnumber;
            
            // Get all records for this serial number, ordered by created_at DESC
            const recordsQuery = `
                SELECT id, serialnumber, created_at
                FROM system_records
                WHERE serialnumber = $1
                ORDER BY created_at DESC
            `;
            
            const records = await client.query(recordsQuery, [serialNumber]);
            
            if (records.rows.length > 1) {
                const newestRecord = records.rows[0];
                const oldRecords = records.rows.slice(1);
                
                console.log(`Processing ${serialNumber}:`);
                console.log(`  Keeping newest record ID: ${newestRecord.id}`);
                console.log(`  Deleting ${oldRecords.length} older records`);

                // Delete older records
                const oldRecordIds = oldRecords.map(r => r.id);
                await client.query(
                    'DELETE FROM system_records WHERE id = ANY($1)',
                    [oldRecordIds]
                );
            }
        }

        await client.query('COMMIT');
        console.log('Successfully updated duplicate records');

        // Final verification
        const finalCheck = await client.query(`
            SELECT serialnumber, COUNT(*)
            FROM system_records
            GROUP BY serialnumber
            HAVING COUNT(*) > 1
        `);

        if (finalCheck.rows.length === 0) {
            console.log('Verification successful: No duplicate records remain');
        } else {
            console.log('Warning: Some duplicates still exist. Manual review may be needed.');
        }

        process.exit(0);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating duplicate records:', error);
        process.exit(1);
    } finally {
        client.release();
    }
}

// Run the update
updateDuplicateRecords(); 