const { Pool } = require('pg');

const pool = new Pool({
    user: 'zero',
    host: '192.168.0.10',
    database: 'zerodb',
    password: 'zero',
    port: 5432,
});

async function restoreFromProductKeys() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // First check product_keys data
        const checkQuery = `
            SELECT COUNT(*) as count 
            FROM product_keys 
            WHERE is_current = true
        `;
        const checkResult = await client.query(checkQuery);
        console.log('Number of product keys to process:', checkResult.rows[0].count);

        if (checkResult.rows[0].count > 0) {
            // Clear current system_records
            await client.query('DELETE FROM system_records');

            // Insert data from product_keys to system_records
            const insertQuery = `
                INSERT INTO system_records (
                    computername,
                    operatingsystem,
                    created_at,
                    is_current
                )
                SELECT 
                    computername,
                    windowsos_new as operatingsystem,
                    created_at,
                    is_current
                FROM product_keys
                WHERE is_current = true
            `;

            const result = await client.query(insertQuery);
            console.log('Inserted records:', result.rowCount);

            // Also copy to records table
            await client.query('DELETE FROM records');
            const copyQuery = `
                INSERT INTO records (
                    computername,
                    created_at
                )
                SELECT 
                    computername,
                    created_at
                FROM product_keys
                WHERE is_current = true
            `;

            const copyResult = await client.query(copyQuery);
            console.log('Copied to records:', copyResult.rowCount);
        }

        await client.query('COMMIT');
        console.log('Data restoration completed successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error restoring data:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

restoreFromProductKeys(); 