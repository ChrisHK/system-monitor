const { Pool } = require('pg');

const pool = new Pool({
    user: 'zero',
    host: '192.168.0.10',
    database: 'zerodb',
    password: 'zero',
    port: 5432,
});

async function restoreData() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // First check if backup table exists and has data
        const checkQuery = `
            SELECT COUNT(*) as count 
            FROM system_records_backup
        `;
        const checkResult = await client.query(checkQuery);
        console.log('Number of backup records to restore:', checkResult.rows[0].count);

        if (checkResult.rows[0].count > 0) {
            // Clear current system_records
            await client.query('DELETE FROM system_records');
            console.log('Cleared existing records');

            // Copy data from backup to system_records
            const restoreQuery = `
                INSERT INTO system_records (
                    id,
                    serialnumber,
                    computername,
                    manufacturer,
                    model,
                    systemsku,
                    operatingsystem,
                    cpu,
                    resolution,
                    graphicscard,
                    touchscreen,
                    ram_gb,
                    disks,
                    design_capacity,
                    full_charge_capacity,
                    cycle_count,
                    battery_health,
                    created_at,
                    is_current
                )
                SELECT 
                    original_id,
                    serialnumber,
                    computername,
                    manufacturer,
                    model,
                    systemsku,
                    operatingsystem,
                    cpu,
                    resolution,
                    graphicscard,
                    touchscreen,
                    ram_gb,
                    disks,
                    design_capacity,
                    full_charge_capacity,
                    cycle_count,
                    battery_health,
                    created_at,
                    is_current
                FROM system_records_backup
            `;

            const result = await client.query(restoreQuery);
            console.log('Restored records:', result.rowCount);
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

restoreData(); 