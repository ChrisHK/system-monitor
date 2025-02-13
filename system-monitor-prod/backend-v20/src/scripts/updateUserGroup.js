const { Pool } = require('pg');
const pool = new Pool({
    user: 'zero',
    host: 'localhost',
    database: 'zerodev',
    password: 'zero',
    port: 5432
});

async function updateUserGroup() {
    const client = await pool.connect();
    try {
        // Get admin group ID
        const groupResult = await client.query('SELECT id FROM groups WHERE name = $1', ['admin']);
        if (groupResult.rows.length === 0) {
            throw new Error('Admin group not found');
        }
        const adminGroupId = groupResult.rows[0].id;

        // Update user 1's group
        await client.query('UPDATE users SET group_id = $1 WHERE id = $2', [adminGroupId, 1]);
        console.log('Successfully updated user 1 to admin group');
    } catch (error) {
        console.error('Error updating user group:', error);
    } finally {
        await client.release();
        await pool.end();
    }
}

updateUserGroup(); 