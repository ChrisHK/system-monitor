const { query } = require('../index');

async function up() {
    // 添加 permissions 列到 groups 表
    await query(`
        ALTER TABLE groups 
        ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;
    `);

    // 更新現有組的權限
    await query(`
        UPDATE groups 
        SET permissions = '["read"]'::jsonb 
        WHERE name = 'user' AND permissions IS NULL;
    `);

    await query(`
        UPDATE groups 
        SET permissions = '["read", "write", "admin"]'::jsonb 
        WHERE name = 'admin' AND permissions IS NULL;
    `);
}

async function down() {
    // 移除 permissions 列
    await query(`
        ALTER TABLE groups 
        DROP COLUMN IF EXISTS permissions;
    `);
}

module.exports = {
    up,
    down
}; 