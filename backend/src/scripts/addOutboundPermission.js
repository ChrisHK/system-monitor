require('dotenv').config();
const pool = require('../db');

async function addOutboundPermission() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 為所有組添加 outbound 權限，預設為 false
        const result = await client.query(`
            INSERT INTO group_permissions (group_id, permission_type, permission_value)
            SELECT g.id, 'outbound', 'false'::jsonb
            FROM groups g
            WHERE NOT EXISTS (
                SELECT 1 FROM group_permissions gp 
                WHERE gp.group_id = g.id AND gp.permission_type = 'outbound'
            );
        `);

        console.log('Added outbound permissions');

        // 為 admin 組啟用 outbound 權限
        const adminResult = await client.query(`
            UPDATE group_permissions 
            SET permission_value = 'true'::jsonb
            FROM groups g
            WHERE group_permissions.group_id = g.id 
            AND g.name = 'admin' 
            AND permission_type = 'outbound';
        `);

        console.log('Updated admin group outbound permission');

        // 檢查權限設置
        const checkResult = await client.query(`
            SELECT g.name as group_name, gp.permission_type, gp.permission_value
            FROM groups g
            JOIN group_permissions gp ON g.id = gp.group_id
            WHERE gp.permission_type = 'outbound'
            ORDER BY g.name;
        `);

        console.log('Current outbound permissions:', checkResult.rows);

        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error adding outbound permission:', error);
    } finally {
        client.release();
    }
}

addOutboundPermission(); 