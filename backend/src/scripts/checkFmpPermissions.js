require('dotenv').config();
const pool = require('../db');

async function checkFmpPermissions() {
    try {
        // 檢查 group_permissions 表中的權限
        const result = await pool.query(`
            SELECT gp.* 
            FROM group_permissions gp
            WHERE gp.group_id = 3
        `);

        console.log('FMP group permissions:', result.rows);

        // 檢查 groups 表中的組信息
        const groupResult = await pool.query(`
            SELECT g.* 
            FROM groups g
            WHERE g.id = 3
        `);

        console.log('FMP group details:', groupResult.rows);

    } catch (error) {
        console.error('Error checking FMP permissions:', error);
    } finally {
        await pool.end();
    }
}

checkFmpPermissions(); 