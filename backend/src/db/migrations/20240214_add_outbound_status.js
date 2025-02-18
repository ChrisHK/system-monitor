const { query } = require('../index');

async function up() {
    // Add outbound_status column to system_records table
    await query(`
        ALTER TABLE system_records 
        ADD COLUMN IF NOT EXISTS outbound_status VARCHAR(20) DEFAULT 'available';
    `);

    console.log('Added outbound_status column to system_records table');
}

async function down() {
    // Remove outbound_status column
    await query(`
        ALTER TABLE system_records 
        DROP COLUMN IF EXISTS outbound_status;
    `);

    console.log('Removed outbound_status column from system_records table');
}

module.exports = {
    up,
    down
}; 