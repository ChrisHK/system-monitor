-- 開始事務
BEGIN;

-- 檢查並添加缺失的列
DO $$ 
BEGIN 
    -- 檢查 started_at 列是否存在
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'processing_logs' AND column_name = 'started_at') THEN
        ALTER TABLE processing_logs ADD COLUMN started_at TIMESTAMP WITH TIME ZONE;
    END IF;

    -- 檢查 completed_at 列是否存在
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'processing_logs' AND column_name = 'completed_at') THEN
        ALTER TABLE processing_logs ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 修改時間戳列類型為帶時區的時間戳
ALTER TABLE processing_logs 
    ALTER COLUMN started_at TYPE TIMESTAMP WITH TIME ZONE 
    USING COALESCE(started_at AT TIME ZONE 'UTC', NOW()),
    ALTER COLUMN completed_at TYPE TIMESTAMP WITH TIME ZONE 
    USING COALESCE(completed_at AT TIME ZONE 'UTC', NOW());

-- 修改 processing_logs_archive 表
ALTER TABLE processing_logs_archive 
    ALTER COLUMN started_at TYPE TIMESTAMP WITH TIME ZONE 
    USING COALESCE(started_at AT TIME ZONE 'UTC', NOW()),
    ALTER COLUMN completed_at TYPE TIMESTAMP WITH TIME ZONE 
    USING COALESCE(completed_at AT TIME ZONE 'UTC', NOW()),
    ALTER COLUMN archived_at TYPE TIMESTAMP WITH TIME ZONE 
    USING COALESCE(archived_at AT TIME ZONE 'UTC', NOW());

-- 設置默認值
ALTER TABLE processing_logs 
    ALTER COLUMN started_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN completed_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE processing_logs_archive 
    ALTER COLUMN started_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN completed_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN archived_at SET DEFAULT CURRENT_TIMESTAMP;

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_processing_logs_started_at ON processing_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_processing_logs_completed_at ON processing_logs(completed_at);
CREATE INDEX IF NOT EXISTS idx_processing_logs_archive_archived_at ON processing_logs_archive(archived_at);

-- 提交事務
COMMIT;

-- 驗證
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name IN ('processing_logs', 'processing_logs_archive')
AND column_name IN ('started_at', 'completed_at', 'archived_at');

-- 回滾腳本
/*
BEGIN;
DROP INDEX IF EXISTS idx_processing_logs_started_at;
DROP INDEX IF EXISTS idx_processing_logs_completed_at;
DROP INDEX IF EXISTS idx_processing_logs_archive_archived_at;

ALTER TABLE processing_logs 
    ALTER COLUMN started_at TYPE TIMESTAMP,
    ALTER COLUMN completed_at TYPE TIMESTAMP;

ALTER TABLE processing_logs_archive 
    ALTER COLUMN started_at TYPE TIMESTAMP,
    ALTER COLUMN completed_at TYPE TIMESTAMP,
    ALTER COLUMN archived_at TYPE TIMESTAMP;

COMMIT;
*/ 