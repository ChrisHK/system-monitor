const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 創建數據庫連接池
const pool = new Pool({
    user: 'zero',
    host: 'localhost',
    database: 'zerodev',
    password: 'zero',
    port: 5432,
});

async function runMigration() {
    try {
        // 讀取並執行 groups.sql
        const groupsSqlPath = path.join(__dirname, 'migrations', 'groups.sql');
        const groupsSql = fs.readFileSync(groupsSqlPath, 'utf8');
        await pool.query(groupsSql);
        console.log('Groups migration completed successfully');

        // 讀取並執行 group_store_permissions.sql
        const permissionsSqlPath = path.join(__dirname, 'migrations', 'group_store_permissions.sql');
        const permissionsSql = fs.readFileSync(permissionsSqlPath, 'utf8');
        await pool.query(permissionsSql);
        console.log('Group store permissions migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
}

runMigration(); 