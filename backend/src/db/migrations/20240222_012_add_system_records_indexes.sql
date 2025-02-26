-- 開始事務
BEGIN;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_system_records_is_current ON system_records(is_current);
CREATE INDEX IF NOT EXISTS idx_system_records_created_at ON system_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_records_serialnumber ON system_records(serialnumber);

-- 添加註釋
COMMENT ON INDEX idx_system_records_is_current IS '用於過濾當前記錄的索引';
COMMENT ON INDEX idx_system_records_created_at IS '用於按創建時間排序的索引';
COMMENT ON INDEX idx_system_records_serialnumber IS '用於按序列號查詢的索引';

-- 提交事務
COMMIT;

-- 回滾腳本
/*
BEGIN;
DROP INDEX IF EXISTS idx_system_records_is_current;
DROP INDEX IF EXISTS idx_system_records_created_at;
DROP INDEX IF EXISTS idx_system_records_serialnumber;
COMMIT;
*/ 