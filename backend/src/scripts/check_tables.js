const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
});

async function checkTables() {
    try {
        // 檢查標籤相關表格
        const result = await pool.query(`
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name IN ('tag_categories', 'tags', 'tag_relations')
            ORDER BY table_name, ordinal_position;
        `);

        if (result.rows.length === 0) {
            console.log('No tag-related tables found');
            return;
        }

        // 按表格分組顯示結構
        const tables = {};
        result.rows.forEach(row => {
            if (!tables[row.table_name]) {
                tables[row.table_name] = [];
            }
            tables[row.table_name].push({
                column: row.column_name,
                type: row.data_type
            });
        });

        // 顯示每個表格的結構
        Object.entries(tables).forEach(([tableName, columns]) => {
            console.log(`\nTable: ${tableName}`);
            console.log('Columns:');
            columns.forEach(col => {
                console.log(`  - ${col.column} (${col.type})`);
            });
        });

    } catch (error) {
        console.error('Error checking tables:', error);
    } finally {
        await pool.end();
    }
}

checkTables(); 