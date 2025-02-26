const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const dotenv = require('dotenv');

// 加載環境變量
const envFile = process.env.NODE_ENV === 'production' 
    ? '.env.production'
    : process.env.NODE_ENV === 'development' 
        ? '.env.development' 
        : '.env';

const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });

console.log('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    envFile,
    envPath
});

// 配置數據庫連接
const pool = new Pool({
    user: process.env.DB_USER || 'zero',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'zerodev',
    password: process.env.DB_PASSWORD || 'zero',
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    max: parseInt(process.env.DB_MAX_CONNECTIONS || '20')
});

console.log('Database configuration:', {
    host: pool.options.host,
    database: pool.options.database,
    user: pool.options.user,
    port: pool.options.port,
    ssl: !!pool.options.ssl
});

async function runMigration() {
    const client = await pool.connect();
    try {
        console.log('Starting migration...');
        
        // 檢查數據庫連接
        console.log('Testing database connection...');
        await client.query('SELECT 1');
        console.log('Database connection successful');

        // 開始事務
        await client.query('BEGIN');

        try {
            // 檢查表是否存在
            const tableExists = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'outbound_items'
                );
            `);

            if (!tableExists.rows[0].exists) {
                // 創建表
                console.log('Creating table...');
                await client.query(`
                    CREATE TABLE outbound_items (
                        id SERIAL PRIMARY KEY,
                        outbound_id INTEGER NOT NULL,
                        item_id INTEGER NOT NULL,
                        quantity INTEGER NOT NULL DEFAULT 0,
                        status VARCHAR(50) NOT NULL DEFAULT 'pending',
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        created_by INTEGER,
                        completed_at TIMESTAMP WITH TIME ZONE,
                        completed_by INTEGER
                    )
                `);
                console.log('Table created successfully');
            } else {
                console.log('Table already exists');
            }

            // 創建索引
            console.log('Creating indexes...');
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_outbound_items_status 
                ON outbound_items(status)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_outbound_items_completed_at 
                ON outbound_items(completed_at)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_outbound_items_created_at 
                ON outbound_items(created_at)
            `);
            console.log('Indexes created successfully');

            // 添加外鍵約束
            console.log('Adding foreign key constraints...');
            await client.query(`
                ALTER TABLE outbound_items
                DROP CONSTRAINT IF EXISTS fk_outbound_items_created_by,
                ADD CONSTRAINT fk_outbound_items_created_by 
                FOREIGN KEY (created_by) REFERENCES users(id)
                ON DELETE SET NULL
            `);
            await client.query(`
                ALTER TABLE outbound_items
                DROP CONSTRAINT IF EXISTS fk_outbound_items_completed_by,
                ADD CONSTRAINT fk_outbound_items_completed_by 
                FOREIGN KEY (completed_by) REFERENCES users(id)
                ON DELETE SET NULL
            `);
            console.log('Foreign key constraints added successfully');

            // 添加表註釋
            console.log('Adding table comment...');
            await client.query(`
                COMMENT ON TABLE outbound_items IS 'Stores outbound items with their status and tracking information'
            `);
            console.log('Table comment added successfully');

            // 提交事務
            await client.query('COMMIT');
            console.log('Migration completed successfully');

            // 驗證結果
            const { rows } = await client.query(`
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default
                FROM information_schema.columns 
                WHERE table_name = 'outbound_items'
                ORDER BY ordinal_position
            `);
            console.log('Table structure:');
            console.table(rows);

        } catch (error) {
            console.error('Error during migration:', error);
            await client.query('ROLLBACK');
            throw error;
        }
        
    } catch (error) {
        console.error('Migration failed:', {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            position: error.position
        });
        throw error;
    } finally {
        try {
            await client.release();
            await pool.end();
        } catch (err) {
            console.error('Error closing connections:', err);
        }
    }
}

// 執行遷移
console.log('Starting migration process...');
runMigration()
    .then(() => {
        console.log('Migration completed successfully');
        process.exit(0);
    })
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    }); 