-- 開始事務
BEGIN;

-- 修改 processing_logs 表的數值欄位為 NUMERIC
ALTER TABLE processing_logs
    ALTER COLUMN total_items TYPE NUMERIC USING total_items::numeric,
    ALTER COLUMN processed_count TYPE NUMERIC USING processed_count::numeric,
    ALTER COLUMN error_count TYPE NUMERIC USING error_count::numeric;

-- 修改 processing_logs_archive 表的數值欄位為 NUMERIC
ALTER TABLE processing_logs_archive
    ALTER COLUMN total_items TYPE NUMERIC USING total_items::numeric,
    ALTER COLUMN processed_count TYPE NUMERIC USING processed_count::numeric,
    ALTER COLUMN error_count TYPE NUMERIC USING error_count::numeric;

-- 修改默認值
ALTER TABLE processing_logs
    ALTER COLUMN total_items SET DEFAULT 0.0,
    ALTER COLUMN processed_count SET DEFAULT 0.0,
    ALTER COLUMN error_count SET DEFAULT 0.0;

-- 添加檢查約束確保數值非負
ALTER TABLE processing_logs
    ADD CONSTRAINT check_total_items_positive CHECK (total_items >= 0),
    ADD CONSTRAINT check_processed_count_positive CHECK (processed_count >= 0),
    ADD CONSTRAINT check_error_count_positive CHECK (error_count >= 0);

ALTER TABLE processing_logs_archive
    ADD CONSTRAINT check_archive_total_items_positive CHECK (total_items >= 0),
    ADD CONSTRAINT check_archive_processed_count_positive CHECK (processed_count >= 0),
    ADD CONSTRAINT check_archive_error_count_positive CHECK (error_count >= 0);

-- 提交事務
COMMIT;

-- 驗證
SELECT 
    table_name,
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('processing_logs', 'processing_logs_archive')
AND column_name IN ('total_items', 'processed_count', 'error_count')
ORDER BY table_name, column_name;

-- 回滾腳本
/*
BEGIN;
-- 移除檢查約束
ALTER TABLE processing_logs
    DROP CONSTRAINT IF EXISTS check_total_items_positive,
    DROP CONSTRAINT IF EXISTS check_processed_count_positive,
    DROP CONSTRAINT IF EXISTS check_error_count_positive;

ALTER TABLE processing_logs_archive
    DROP CONSTRAINT IF EXISTS check_archive_total_items_positive,
    DROP CONSTRAINT IF EXISTS check_archive_processed_count_positive,
    DROP CONSTRAINT IF EXISTS check_archive_error_count_positive;

-- 恢復為整數類型
ALTER TABLE processing_logs
    ALTER COLUMN total_items TYPE INTEGER USING total_items::integer,
    ALTER COLUMN processed_count TYPE INTEGER USING processed_count::integer,
    ALTER COLUMN error_count TYPE INTEGER USING error_count::integer,
    ALTER COLUMN total_items SET DEFAULT 0,
    ALTER COLUMN processed_count SET DEFAULT 0,
    ALTER COLUMN error_count SET DEFAULT 0;

ALTER TABLE processing_logs_archive
    ALTER COLUMN total_items TYPE INTEGER USING total_items::integer,
    ALTER COLUMN processed_count TYPE INTEGER USING processed_count::integer,
    ALTER COLUMN error_count TYPE INTEGER USING error_count::integer;

COMMIT;
*/ 