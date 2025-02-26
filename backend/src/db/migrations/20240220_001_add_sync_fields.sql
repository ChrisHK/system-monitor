-- 開始事務
BEGIN;

-- 設置時區為 UTC-5 (America/New_York)
SET timezone = 'America/New_York';

-- 添加同步狀態相關欄位
ALTER TABLE system_records 
    ADD COLUMN IF NOT EXISTS sync_status VARCHAR(20) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS last_sync_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS sync_version INTEGER DEFAULT 1;

-- 創建索引以提高查詢效能
CREATE INDEX IF NOT EXISTS idx_system_records_sync_status ON system_records(sync_status);
CREATE INDEX IF NOT EXISTS idx_system_records_sync_version ON system_records(sync_version);
CREATE INDEX IF NOT EXISTS idx_system_records_last_sync_time ON system_records(last_sync_time);

-- 提交事務
COMMIT;

-- 回滾腳本
/*
BEGIN;
DROP INDEX IF EXISTS idx_system_records_last_sync_time;
DROP INDEX IF EXISTS idx_system_records_sync_version;
DROP INDEX IF EXISTS idx_system_records_sync_status;

ALTER TABLE system_records
    DROP COLUMN IF EXISTS sync_version,
    DROP COLUMN IF EXISTS last_sync_time,
    DROP COLUMN IF EXISTS sync_status;
COMMIT;
*/ 