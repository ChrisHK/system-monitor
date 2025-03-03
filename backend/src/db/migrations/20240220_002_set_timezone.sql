-- 開始事務
BEGIN;

-- 設置數據庫時區為 America/New_York (UTC-5)
ALTER DATABASE zerouniq_db SET timezone TO 'America/New_York';

-- 設置當前會話時區
SET timezone = 'America/New_York';

-- 修改時間戳列類型為帶時區的時間戳
ALTER TABLE system_records 
    ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE,
    ALTER COLUMN last_sync_time TYPE TIMESTAMP WITH TIME ZONE;

-- 更新現有記錄的時間戳為新時區
UPDATE system_records 
SET 
    created_at = COALESCE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York', NOW()),
    last_sync_time = COALESCE(last_sync_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York', NOW())
WHERE 
    created_at IS NOT NULL 
    OR last_sync_time IS NOT NULL;

-- 修改默認值為帶時區的當前時間戳
ALTER TABLE system_records 
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN last_sync_time SET DEFAULT CURRENT_TIMESTAMP;

-- 提交事務
COMMIT;

-- 驗證時區設置和時間戳
SELECT current_setting('timezone');
SELECT NOW()::timestamptz;
SELECT * FROM system_records LIMIT 1;

-- 回滾腳本
/*
BEGIN;
-- 恢復時區設置
ALTER DATABASE zerouniq_db SET timezone TO 'UTC';
SET timezone = 'UTC';

-- 恢復時間戳列類型為不帶時區
ALTER TABLE system_records 
    ALTER COLUMN created_at TYPE TIMESTAMP,
    ALTER COLUMN last_sync_time TYPE TIMESTAMP;

-- 更新記錄時間為 UTC
UPDATE system_records 
SET 
    created_at = created_at AT TIME ZONE 'America/New_York' AT TIME ZONE 'UTC',
    last_sync_time = last_sync_time AT TIME ZONE 'America/New_York' AT TIME ZONE 'UTC'
WHERE 
    created_at IS NOT NULL 
    OR last_sync_time IS NOT NULL;

-- 恢復默認值
ALTER TABLE system_records 
    ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN last_sync_time SET DEFAULT CURRENT_TIMESTAMP;

COMMIT;
*/ 