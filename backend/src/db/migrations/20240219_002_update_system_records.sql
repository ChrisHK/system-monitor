-- 開始事務
BEGIN;

-- 更新 system_records 表結構
ALTER TABLE system_records
    ADD COLUMN IF NOT EXISTS battery JSONB DEFAULT '{}'::jsonb,
    ALTER COLUMN ram_gb TYPE FLOAT,
    ALTER COLUMN disks TYPE JSONB USING disks::jsonb;

-- 創建索引以提高查詢效能
CREATE INDEX IF NOT EXISTS idx_system_records_serialnumber ON system_records(serialnumber);
CREATE INDEX IF NOT EXISTS idx_system_records_manufacturer ON system_records(manufacturer);
CREATE INDEX IF NOT EXISTS idx_system_records_model ON system_records(model);
CREATE INDEX IF NOT EXISTS idx_system_records_disks ON system_records USING gin (disks);
CREATE INDEX IF NOT EXISTS idx_system_records_battery ON system_records USING gin (battery);

-- 提交事務
COMMIT;

-- 回滾腳本
/*
BEGIN;
DROP INDEX IF EXISTS idx_system_records_battery;
DROP INDEX IF EXISTS idx_system_records_disks;
DROP INDEX IF EXISTS idx_system_records_model;
DROP INDEX IF EXISTS idx_system_records_manufacturer;
DROP INDEX IF EXISTS idx_system_records_serialnumber;

ALTER TABLE system_records
    DROP COLUMN IF EXISTS battery,
    ALTER COLUMN ram_gb TYPE INTEGER,
    ALTER COLUMN disks TYPE TEXT;
COMMIT;
*/ 