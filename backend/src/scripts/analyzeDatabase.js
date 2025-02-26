const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// 直接配置開發環境數據庫連接
const pool = new Pool({
    user: 'zero',
    host: 'localhost',
    database: 'zerodev',
    password: 'zero',
    port: 5432,
});

async function analyzeDatabase() {
    const client = await pool.connect();
    try {
        console.log('開始分析數據庫...');

        // 1. 獲取 system_records 表結構
        const tableStructure = await client.query(`
            SELECT 
                column_name,
                data_type,
                column_default,
                is_nullable,
                character_maximum_length
            FROM information_schema.columns 
            WHERE table_name = 'system_records'
            ORDER BY ordinal_position;
        `);

        // 2. 分析 disks 字段的數據
        const disksAnalysis = await client.query(`
            WITH disk_stats AS (
                SELECT 
                    disks,
                    COUNT(*) as count,
                    -- 檢查完整格式
                    disks as raw_format,
                    -- 移除所有引號
                    REPLACE(REPLACE(disks, '"', ''), '''', '') as clean_format,
                    -- 檢查數字部分
                    REGEXP_REPLACE(REPLACE(REPLACE(disks, '"', ''), '''', ''), '[^0-9.]', '', 'g') as numeric_part,
                    -- 檢查單位
                    CASE 
                        WHEN REPLACE(REPLACE(disks, '"', ''), '''', '') LIKE '%TB' THEN 'TB'
                        WHEN REPLACE(REPLACE(disks, '"', ''), '''', '') LIKE '%GB' THEN 'GB'
                        ELSE NULL 
                    END as unit
                FROM system_records
                WHERE disks IS NOT NULL
                GROUP BY disks
            )
            SELECT 
                raw_format,
                clean_format,
                count as occurrence_count,
                numeric_part as size_value,
                unit as size_unit,
                LENGTH(raw_format) as total_length,
                raw_format ~ '^".*"$' as has_outer_quotes,
                raw_format ~ '.*"".*' as has_double_quotes,
                raw_format ~ '.*''.*' as has_single_quotes
            FROM disk_stats
            ORDER BY count DESC, raw_format
            LIMIT 50;
        `);

        // 3. 獲取表的約束
        const constraints = await client.query(`
            SELECT
                conname as constraint_name,
                pg_get_constraintdef(c.oid) as constraint_definition,
                contype as constraint_type
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'system_records'::regclass
            AND n.nspname = 'public';
        `);

        // 4. 獲取索引信息
        const indexes = await client.query(`
            SELECT
                indexname,
                indexdef
            FROM pg_indexes
            WHERE tablename = 'system_records'
            AND schemaname = 'public'
            ORDER BY indexname;
        `);

        // 5. 分析數據分佈
        const dataDistribution = await client.query(`
            SELECT
                COUNT(*) as total_records,
                COUNT(CASE WHEN disks IS NULL THEN 1 END) as null_disks,
                COUNT(CASE WHEN disks ~ '^[^:]+:[^:]+:[^:]+$' THEN 1 END) as standard_format_count,
                COUNT(CASE WHEN disks ~ 'GB$' THEN 1 END) as gb_suffix_count,
                COUNT(CASE WHEN disks ~ 'TB$' THEN 1 END) as tb_suffix_count,
                MIN(created_at) as oldest_record,
                MAX(created_at) as newest_record
            FROM system_records;
        `);

        // 生成分析報告
        const report = {
            timestamp: new Date().toISOString(),
            table_structure: tableStructure.rows,
            disks_analysis: {
                samples: disksAnalysis.rows,
                distribution: dataDistribution.rows[0]
            },
            constraints: constraints.rows,
            indexes: indexes.rows
        };

        // 將報告保存為 JSON 文件
        await fs.writeFile(
            path.join(__dirname, 'database_analysis.json'),
            JSON.stringify(report, null, 2)
        );

        // 生成 SQL migration 文件
        let sqlContent = `-- 自動生成的 SQL migration 文件
-- 生成時間: ${new Date().toISOString()}
-- 基於開發環境數據庫分析

BEGIN;

-- 表結構信息
/*
${JSON.stringify(tableStructure.rows, null, 2)}
*/

-- Disks 字段分析
/*
${JSON.stringify(disksAnalysis.rows, null, 2)}
*/

-- 數據分佈
/*
${JSON.stringify(dataDistribution.rows[0], null, 2)}
*/

-- 現有約束
/*
${JSON.stringify(constraints.rows, null, 2)}
*/

-- 現有索引
/*
${JSON.stringify(indexes.rows, null, 2)}
*/

-- 根據分析生成的 Migration SQL
ALTER TABLE system_records ADD COLUMN IF NOT EXISTS disks_temp TEXT;
ALTER TABLE system_records ADD COLUMN IF NOT EXISTS disks_gb NUMERIC DEFAULT 0;

-- 更新數據
UPDATE system_records 
SET 
    disks_temp = 
        CASE 
            WHEN disks IS NULL OR disks = '' THEN 
                NULL
            WHEN disks ~ '^[^:]+:[^:]+:[^:]+$' THEN 
                disks
            WHEN disks ~ '^[0-9]+GB$' THEN 
                'SSD:' || disks || ':Unknown'
            ELSE 
                'Unknown:' || COALESCE(disks, '0GB') || ':Unknown'
        END,
    disks_gb = 
        CASE 
            WHEN disks ~ '[0-9]+' THEN 
                (regexp_replace(disks, '[^0-9]', '', 'g'))::NUMERIC
            ELSE 
                0
        END;

-- 驗證數據
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM system_records 
        WHERE disks_temp IS NOT NULL 
        AND disks_temp NOT LIKE '%:%:%'
    ) THEN
        RAISE EXCEPTION 'Invalid disk format found after conversion';
    END IF;
END $$;

-- 替換列
ALTER TABLE system_records DROP COLUMN disks;
ALTER TABLE system_records RENAME COLUMN disks_temp TO disks;

-- 添加約束
ALTER TABLE system_records 
    ADD CONSTRAINT check_disks_format 
    CHECK (disks ~ '^[^:]+:[^:]+:[^:]+$');

ALTER TABLE system_records 
    ADD CONSTRAINT check_disks_gb_positive 
    CHECK (disks_gb >= 0);

COMMIT;

-- 回滾腳本
/*
BEGIN;
    ALTER TABLE system_records DROP CONSTRAINT IF EXISTS check_disks_format;
    ALTER TABLE system_records DROP CONSTRAINT IF EXISTS check_disks_gb_positive;
    ALTER TABLE system_records DROP COLUMN IF EXISTS disks_gb;
    ALTER TABLE system_records RENAME COLUMN disks TO disks_old;
    ALTER TABLE system_records ADD COLUMN disks TEXT;
    UPDATE system_records 
    SET disks = 
        CASE 
            WHEN disks_old ~ '^[^:]+:([^:]+):[^:]+$' 
            THEN regexp_replace(regexp_matches(disks_old, '^[^:]+:([^:]+):[^:]+$')[1], '[^0-9]', '', 'g') || 'GB'
            ELSE disks_old
        END;
    ALTER TABLE system_records DROP COLUMN disks_old;
COMMIT;
*/
`;

        // 保存 SQL 文件
        await fs.writeFile(
            path.join(__dirname, 'database_migration.sql'),
            sqlContent
        );

        console.log('分析完成！');
        console.log('報告已保存為: database_analysis.json');
        console.log('SQL 文件已生成: database_migration.sql');

    } catch (error) {
        console.error('分析過程中出錯:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

// 運行分析
analyzeDatabase().catch(console.error); 