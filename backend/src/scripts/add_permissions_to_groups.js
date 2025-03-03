const path = require('path');
const { Pool } = require('pg');

// 根據環境加載配置
function loadConfig(env) {
    // 設置環境變數
    process.env.NODE_ENV = env;
    
    // 加載對應的環境文件
    const envFile = env === 'production' 
        ? path.join(__dirname, '../../.env.production')
        : path.join(__dirname, '../../.env');
    
    require('dotenv').config({ path: envFile });
    
    // 返回數據庫配置
    return {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        port: parseInt(process.env.DB_PORT || '5432'),
        ssl: process.env.DB_SSL === 'true',
        // Connection pool settings
        max: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
        connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
        maxUses: 7500
    };
}

// SQL 命令 - 使用 ALTER TABLE IF EXISTS 來避免權限問題
const SQL_COMMANDS = [
    `
    DO $$
    BEGIN
        -- 檢查表是否存在
        IF EXISTS (
            SELECT FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = 'groups'
        ) THEN
            -- 檢查列是否存在
            IF NOT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'groups' 
                AND column_name = 'permissions'
            ) THEN
                ALTER TABLE groups 
                ADD COLUMN permissions JSONB DEFAULT '[]'::jsonb;
            END IF;
        END IF;
    END $$;
    `,
    `
    DO $$
    BEGIN
        UPDATE groups 
        SET permissions = '["read"]'::jsonb 
        WHERE name = 'user' 
        AND (permissions IS NULL OR permissions = '[]'::jsonb);
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'Insufficient privileges to update groups table';
    END $$;
    `,
    `
    DO $$
    BEGIN
        UPDATE groups 
        SET permissions = '["read", "write", "admin"]'::jsonb 
        WHERE name = 'admin' 
        AND (permissions IS NULL OR permissions = '[]'::jsonb);
    EXCEPTION
        WHEN insufficient_privilege THEN
            RAISE NOTICE 'Insufficient privileges to update groups table';
    END $$;
    `
];

async function runMigration(env) {
    // 加載環境配置
    const config = loadConfig(env);
    console.log(`\n=== 環境配置 (${env}) ===`);
    console.log('Database:', {
        host: config.host,
        database: config.database,
        user: config.user,
        port: config.port,
        ssl: config.ssl
    });

    const pool = new Pool(config);

    console.log(`\n=== 開始在 ${env} 環境執行遷移 ===`);

    try {
        // 連接測試
        await pool.query('SELECT NOW()');
        console.log(`✓ 成功連接到 ${env} 數據庫`);

        // 檢查數據庫權限
        const permissionCheck = await pool.query(`
            SELECT has_table_privilege(current_user, 'groups', 'UPDATE') as can_update,
                   has_table_privilege(current_user, 'groups', 'ALTER') as can_alter;
        `);
        
        const { can_update, can_alter } = permissionCheck.rows[0];
        console.log(`數據庫權限檢查:
- UPDATE 權限: ${can_update ? '✓' : '✗'}
- ALTER 權限: ${can_alter ? '✓' : '✗'}`);

        if (!can_update && !can_alter) {
            throw new Error('缺少必要的數據庫權限，請聯繫數據庫管理員');
        }

        // 執行每個 SQL 命令
        for (const sql of SQL_COMMANDS) {
            try {
                await pool.query(sql);
                console.log(`✓ 成功執行: ${sql.trim().split('\n')[1]}...`);
            } catch (err) {
                if (err.code === '42501') { // 權限錯誤
                    console.log(`⚠ 權限不足，無法執行: ${sql.trim().split('\n')[1]}...`);
                } else if (err.code === '42701') { // 列已存在
                    console.log(`ℹ 列已存在，跳過`);
                } else {
                    throw err;
                }
            }
        }

        // 驗證遷移
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'groups' AND column_name = 'permissions'
        `);

        if (result.rows.length > 0) {
            console.log(`✓ 驗證成功：permissions 列已存在且類型為 ${result.rows[0].data_type}`);
            
            // 檢查權限值
            const permissionsCheck = await pool.query(`
                SELECT name, permissions 
                FROM groups 
                WHERE name IN ('admin', 'user')
            `);
            
            console.log('\n當前權限配置:');
            permissionsCheck.rows.forEach(row => {
                console.log(`- ${row.name}: ${JSON.stringify(row.permissions)}`);
            });
        } else {
            console.log(`⚠ 警告：未找到 permissions 列`);
        }

    } catch (err) {
        console.error(`❌ 錯誤：${err.message}`);
        if (err.stack) {
            console.error('詳細錯誤信息:', err.stack);
        }
    } finally {
        await pool.end();
        console.log(`=== ${env} 環境遷移完成 ===\n`);
    }
}

async function main() {
    // 檢查命令行參數
    const args = process.argv.slice(2);
    const envs = args.length > 0 ? args : ['development', 'production'];

    console.log('開始數據庫遷移...');
    console.log('目標環境:', envs.join(', '));

    for (const env of envs) {
        if (!['development', 'production'].includes(env)) {
            console.error(`❌ 錯誤：未知環境 "${env}"`);
            continue;
        }
        await runMigration(env);
    }

    console.log('所有遷移完成！');
}

// 執行遷移
main().catch(err => {
    console.error('遷移過程中發生錯誤：', err);
    process.exit(1);
}); 