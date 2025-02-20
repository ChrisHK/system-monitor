const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');

async function exportDatabase() {
    // 加載環境變量
    const env = process.env.NODE_ENV || 'development';
    require('dotenv').config({
        path: path.join(__dirname, `../../.env.${env}`)
    });

    const config = {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432')
    };

    const pool = new Pool(config);
    const timestamp = moment().format('YYYYMMDD');
    const outputFile = path.join(__dirname, `../../../backups/system_monitor_${timestamp}.sql`);

    try {
        console.log('Starting database export...');
        const output = [];

        // 添加文件頭
        output.push(`-- Database export from ${config.database}`);
        output.push(`-- Timestamp: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
        output.push('-- Version: PostgreSQL 17.2');
        output.push('');

        // 清理類型
        output.push(`DO $$
BEGIN
    DROP TYPE IF EXISTS rma_inventory_status CASCADE;
    DROP TYPE IF EXISTS rma_status CASCADE;
    DROP TYPE IF EXISTS store_order_status CASCADE;
    DROP TYPE IF EXISTS store_rma_status CASCADE;
    DROP TYPE IF EXISTS system_record_status CASCADE;
    DROP TYPE IF EXISTS user_role CASCADE;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;`);
        output.push('');

        // 設置搜索路徑
        output.push(`SELECT pg_catalog.set_config('search_path', '', false);`);
        output.push('');

        // 獲取所有表名
        const tablesQuery = await pool.query(`
            SELECT tablename 
            FROM pg_catalog.pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename;
        `);

        // 導出表結構和數據
        for (const { tablename } of tablesQuery.rows) {
            console.log(`Exporting table: ${tablename}`);

            // 獲取表結構
            const structureQuery = await pool.query(`
                SELECT column_name, data_type, character_maximum_length, 
                       is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = $1 
                ORDER BY ordinal_position;
            `, [tablename]);

            // 創建表 SQL
            output.push(`-- Table: public.${tablename}`);
            output.push(`CREATE TABLE IF NOT EXISTS public.${tablename} (`);
            
            const columns = structureQuery.rows.map(col => {
                let line = `    ${col.column_name} ${col.data_type}`;
                if (col.character_maximum_length) {
                    line += `(${col.character_maximum_length})`;
                }
                if (col.is_nullable === 'NO') {
                    line += ' NOT NULL';
                }
                if (col.column_default) {
                    line += ` DEFAULT ${col.column_default}`;
                }
                return line;
            });
            
            output.push(columns.join(',\n'));
            output.push(');');
            output.push('');

            // 獲取表數據
            const dataQuery = await pool.query(`SELECT * FROM ${tablename};`);
            if (dataQuery.rows.length > 0) {
                output.push(`-- Data for table: ${tablename}`);
                for (const row of dataQuery.rows) {
                    const values = Object.values(row).map(val => {
                        if (val === null) return 'NULL';
                        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                        if (typeof val === 'object') return `'${JSON.stringify(val)}'`;
                        return val;
                    });
                    output.push(`INSERT INTO public.${tablename} VALUES (${values.join(', ')});`);
                }
                output.push('');
            }

            // 獲取並導出索引
            const indexesQuery = await pool.query(`
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = $1;
            `, [tablename]);

            if (indexesQuery.rows.length > 0) {
                output.push(`-- Indexes for table: ${tablename}`);
                for (const { indexdef } of indexesQuery.rows) {
                    output.push(`${indexdef};`);
                }
                output.push('');
            }
        }

        // 獲取外鍵約束
        const constraintsQuery = await pool.query(`
            SELECT
                tc.constraint_name,
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY';
        `);

        if (constraintsQuery.rows.length > 0) {
            output.push('-- Foreign key constraints');
            for (const constraint of constraintsQuery.rows) {
                output.push(`ALTER TABLE IF EXISTS ONLY public.${constraint.table_name}`);
                output.push(`    ADD CONSTRAINT ${constraint.constraint_name}`);
                output.push(`    FOREIGN KEY (${constraint.column_name})`);
                output.push(`    REFERENCES public.${constraint.foreign_table_name}(${constraint.foreign_column_name});`);
                output.push('');
            }
        }

        // 寫入文件
        await fs.writeFile(outputFile, output.join('\n'));
        console.log(`Database export completed successfully. File saved to: ${outputFile}`);

    } catch (error) {
        console.error('Export failed:', error);
    } finally {
        await pool.end();
    }
}

// 執行導出
if (require.main === module) {
    exportDatabase().catch(console.error);
}

module.exports = exportDatabase; 