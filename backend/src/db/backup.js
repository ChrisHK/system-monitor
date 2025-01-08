const { Pool } = require('pg');

const pool = new Pool({
    user: 'zero',
    host: '192.168.0.10',
    database: 'zerodb',
    password: 'zero',
    port: 5432,
});

async function backupData() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check permissions
        console.log('Checking database permissions...');
        try {
            const permissionQuery = `
                SELECT 
                    has_table_privilege(current_user, 'system_records', 'SELECT') as can_select,
                    has_database_privilege(current_user, 'zerodb', 'CREATE') as can_create_table
            `;
            const permissionResult = await client.query(permissionQuery);
            const perms = permissionResult.rows[0];
            
            if (!perms.can_select) {
                throw new Error('No SELECT permission on system_records');
            }
            if (!perms.can_create_table) {
                throw new Error('No CREATE permission in database');
            }
            console.log('Permissions verified');
        } catch (permError) {
            console.error('Permission check failed:', permError.message);
            throw permError;
        }

        // Drop existing backup table if exists
        console.log('Dropping existing backup table if exists...');
        try {
            await client.query('DROP TABLE IF EXISTS system_records_backup');
            console.log('Old backup table dropped');
        } catch (dropError) {
            console.error('Failed to drop old backup table:', dropError.message);
            throw dropError;
        }

        // Create backup table if not exists
        console.log('Creating backup table...');
        try {
            const createBackupTable = `
                CREATE TABLE system_records_backup (
                    id SERIAL PRIMARY KEY,
                    original_id INTEGER,
                    serialnumber VARCHAR(255),
                    computername VARCHAR(255),
                    manufacturer VARCHAR(255),
                    model VARCHAR(255),
                    systemsku TEXT,
                    operatingsystem TEXT,
                    cpu TEXT,
                    resolution VARCHAR(255),
                    graphicscard TEXT,
                    touchscreen VARCHAR(255),
                    ram_gb NUMERIC,
                    disks TEXT,
                    design_capacity NUMERIC,
                    full_charge_capacity NUMERIC,
                    cycle_count NUMERIC,
                    battery_health NUMERIC,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP,
                    is_current BOOLEAN,
                    backup_date TIMESTAMP DEFAULT NOW()
                )
            `;
            await client.query(createBackupTable);
            console.log('Backup table created');
        } catch (tableError) {
            console.error('Failed to create backup table:', tableError.message);
            throw tableError;
        }

        // Copy current data to backup
        console.log('Copying data to backup...');
        try {
            const copyData = `
                INSERT INTO system_records_backup (
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
                    updated_at,
                    is_current
                )
                SELECT 
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
                    created_at as updated_at,
                    is_current
                FROM system_records
            `;
            const result = await client.query(copyData);
            console.log(`Backed up ${result.rowCount} records successfully`);
        } catch (copyError) {
            console.error('Failed to copy data:', copyError.message);
            throw copyError;
        }
        
        await client.query('COMMIT');
        console.log('Backup completed successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Backup failed:', error.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

backupData(); 