const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

const runMigration = async () => {
    try {
        // 添加 features 欄位到 group_store_permissions 表
        await pool.query(`
            ALTER TABLE group_store_permissions
            ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{"inventory": false, "orders": false, "rma": false}'::jsonb;
        `);

        // 更新現有記錄的 features 欄位
        await pool.query(`
            UPDATE group_store_permissions
            SET features = '{"inventory": true, "orders": true, "rma": true}'::jsonb
            WHERE features IS NULL;
        `);

        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
};

runMigration(); 