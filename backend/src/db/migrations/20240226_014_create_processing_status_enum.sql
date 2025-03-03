-- backend/src/db/migrations/20240226_014_create_processing_status_enum.sql

-- 開始事務
BEGIN;

-- 檢查是否已存在該類型，如果存在則刪除
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'processing_status') THEN
        DROP TYPE IF EXISTS processing_status CASCADE;
    END IF;
END$$;

-- 創建處理狀態枚舉類型
CREATE TYPE processing_status AS ENUM (
    'processing',      -- 處理中
    'completed',       -- 完成
    'completed_with_errors',  -- 完成但有錯誤
    'failed'          -- 失敗
);

-- 添加註釋
COMMENT ON TYPE processing_status IS '數據處理狀態枚舉類型';

-- 先移除原有的默認值
ALTER TABLE processing_logs 
    ALTER COLUMN status DROP DEFAULT;

-- 修改 status 欄位類型
ALTER TABLE processing_logs 
    ALTER COLUMN status TYPE processing_status 
    USING 
    CASE status
        WHEN 'processing' THEN 'processing'::processing_status
        WHEN 'completed' THEN 'completed'::processing_status
        WHEN 'completed_with_errors' THEN 'completed_with_errors'::processing_status
        WHEN 'failed' THEN 'failed'::processing_status
        ELSE 'processing'::processing_status
    END;

-- 設置新的默認值
ALTER TABLE processing_logs 
    ALTER COLUMN status 
    SET DEFAULT 'processing'::processing_status;

-- 提交事務
COMMIT;

-- 回滾腳本
/*
BEGIN;
-- 先移除默認值
ALTER TABLE processing_logs 
    ALTER COLUMN status DROP DEFAULT;

-- 將 status 欄位改回 varchar
ALTER TABLE processing_logs 
    ALTER COLUMN status TYPE varchar 
    USING status::varchar;

-- 恢復默認值
ALTER TABLE processing_logs 
    ALTER COLUMN status 
    SET DEFAULT 'processing';

-- 刪除枚舉類型
DROP TYPE IF EXISTS processing_status;
COMMIT;
*/
