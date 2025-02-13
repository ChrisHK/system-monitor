require('dotenv').config();
const pool = require('../db');

async function updateFmpPermissions() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // First, check if the FMP group exists and get its ID
        const groupResult = await client.query(`
            SELECT id FROM groups WHERE name = 'FMP';
        `);

        if (groupResult.rows.length === 0) {
            throw new Error('FMP group not found');
        }

        const groupId = groupResult.rows[0].id;

        // Check if the permission already exists
        const permissionResult = await client.query(`
            SELECT * FROM group_permissions 
            WHERE group_id = $1 AND permission_type = 'main_permissions';
        `, [groupId]);

        if (permissionResult.rows.length === 0) {
            // Insert new permission
            console.log('Creating new permission for FMP group');
            await client.query(`
                INSERT INTO group_permissions (group_id, permission_type, permission_value)
                VALUES ($1, 'main_permissions', '{"inventory": true, "inventory_ram": false}'::jsonb);
            `, [groupId]);
        } else {
            // Update existing permission
            console.log('Updating existing permission for FMP group');
            await client.query(`
                UPDATE group_permissions
                SET permission_value = '{"inventory": true, "inventory_ram": false}'::jsonb
                WHERE group_id = $1 AND permission_type = 'main_permissions';
            `, [groupId]);
        }

        // Verify the update
        const verifyResult = await client.query(`
            SELECT g.name as group_name, gp.permission_value
            FROM groups g
            JOIN group_permissions gp ON g.id = gp.group_id
            WHERE g.name = 'FMP'
            AND gp.permission_type = 'main_permissions';
        `);

        await client.query('COMMIT');

        console.log('Verification:', verifyResult.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating FMP permissions:', error);
        throw error;
    } finally {
        client.release();
        // Close the pool after we're done
        await pool.end();
    }
}

// Run the update
updateFmpPermissions()
    .then(() => {
        console.log('Successfully updated FMP group permissions');
        process.exit(0);
    })
    .catch(error => {
        console.error('Failed to update FMP group permissions:', error);
        process.exit(1);
    }); 