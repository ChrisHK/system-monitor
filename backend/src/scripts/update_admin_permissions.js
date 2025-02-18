const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({
    path: path.join(__dirname, '../../.env')
});

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432')
});

async function updateAdminPermissions() {
    const client = await pool.connect();
    try {
        console.log('Starting admin permissions update...');
        
        // Start transaction
        await client.query('BEGIN');

        // Insert missing permissions
        const insertQuery = `
            INSERT INTO group_permissions (group_id, permission_type, permission_value)
            VALUES
                (1, 'inventory', 'true'),
                (1, 'inventory_ram', 'true'),
                (1, 'inbound', 'true'),
                (1, 'purchase_order', 'true'),
                (1, 'tag_management', 'true')
            ON CONFLICT (group_id, permission_type) 
            DO UPDATE SET 
                permission_value = 'true',
                updated_at = NOW()
        `;
        
        await client.query(insertQuery);
        console.log('Inserted/updated main permissions');

        // Update outbound permission
        const updateQuery = `
            UPDATE group_permissions 
            SET permission_value = 'true',
                updated_at = NOW()
            WHERE group_id = 1 
            AND permission_type = 'outbound'
        `;
        
        await client.query(updateQuery);
        console.log('Updated outbound permission');

        // Verify permissions
        const verifyQuery = `
            SELECT g.name as group_name, 
                   gp.permission_type, 
                   gp.permission_value,
                   gp.updated_at
            FROM groups g
            JOIN group_permissions gp ON g.id = gp.group_id
            WHERE g.name = 'admin'
            ORDER BY gp.permission_type
        `;
        
        const result = await client.query(verifyQuery);
        console.log('\nCurrent admin permissions:');
        console.table(result.rows);

        // Commit transaction
        await client.query('COMMIT');
        console.log('\nPermissions update completed successfully');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating permissions:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the update
updateAdminPermissions().catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
}); 