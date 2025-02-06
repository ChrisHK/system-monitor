const { pool } = require('../../config/database');

async function migrate() {
    const client = await pool.connect();
    try {
        // 開始事務
        await client.query('BEGIN');

        console.log('Starting migration: Create categories and tags tables...');

        // 創建分類表
        await client.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT true,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Created categories table');

        // 創建標籤表
        await client.query(`
            CREATE TABLE IF NOT EXISTS tags (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                category_id INTEGER REFERENCES categories(id),
                description TEXT,
                is_active BOOLEAN DEFAULT true,
                created_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Created tags table');

        // 創建索引
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_categories_name 
            ON categories(name) 
            WHERE is_active = true
        `);
        console.log('Created index on categories.name');

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_tags_name 
            ON tags(name) 
            WHERE is_active = true
        `);
        console.log('Created index on tags.name');

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_tags_category_id 
            ON tags(category_id) 
            WHERE is_active = true
        `);
        console.log('Created index on tags.category_id');

        // 添加唯一約束（使用部分索引而不是 WHERE 子句）
        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 
                    FROM pg_constraint 
                    WHERE conname = 'unique_active_category_name'
                ) THEN
                    CREATE UNIQUE INDEX unique_active_category_name 
                    ON categories (name)
                    WHERE is_active = true;
                END IF;
            END $$;
        `);
        console.log('Added unique constraint on categories.name');

        await client.query(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 
                    FROM pg_constraint 
                    WHERE conname = 'unique_active_tag_name_per_category'
                ) THEN
                    CREATE UNIQUE INDEX unique_active_tag_name_per_category 
                    ON tags (name, category_id)
                    WHERE is_active = true;
                END IF;
            END $$;
        `);
        console.log('Added unique constraint on tags.name and category_id');

        // 提交事務
        await client.query('COMMIT');
        console.log('Migration completed successfully');

    } catch (error) {
        // 如果出錯，回滾事務
        await client.query('ROLLBACK');
        console.error('Migration failed:', error);
        throw error;
    } finally {
        // 釋放客戶端
        client.release();
    }
}

// 執行遷移
migrate().catch(console.error);

exports.up = async function(knex) {
    // 開始事務
    await knex.schema.dropTableIfExists('tags');
    await knex.schema.dropTableIfExists('categories');

    // 創建分類表
    await knex.schema.createTable('categories', table => {
        table.increments('id').primary();
        table.string('name', 100).notNullable();
        table.text('description');
        table.boolean('is_active').defaultTo(true);
        table.integer('created_by').references('id').inTable('users');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });

    // 創建標籤表
    await knex.schema.createTable('tags', table => {
        table.increments('id').primary();
        table.string('name', 100).notNullable();
        table.integer('category_id').references('id').inTable('categories');
        table.text('description');
        table.boolean('is_active').defaultTo(true);
        table.integer('created_by').references('id').inTable('users');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });

    // 創建索引
    await knex.raw(`
        CREATE INDEX idx_categories_name ON categories(name) WHERE is_active = true;
        CREATE INDEX idx_tags_name ON tags(name) WHERE is_active = true;
        CREATE INDEX idx_tags_category_id ON tags(category_id) WHERE is_active = true;
    `);
};

exports.down = async function(knex) {
    // 刪除索引
    await knex.raw(`
        DROP INDEX IF EXISTS idx_categories_name;
        DROP INDEX IF EXISTS idx_tags_name;
        DROP INDEX IF EXISTS idx_tags_category_id;
    `);

    // 刪除表
    await knex.schema.dropTableIfExists('tags');
    await knex.schema.dropTableIfExists('categories');
}; 