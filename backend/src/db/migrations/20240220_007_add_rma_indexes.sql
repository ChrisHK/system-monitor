-- 開始事務
BEGIN;

-- 為 rma_records 表添加索引
CREATE INDEX IF NOT EXISTS idx_rma_records_serialnumber ON rma_records(serialnumber);
CREATE INDEX IF NOT EXISTS idx_rma_records_status ON rma_records(status);
CREATE INDEX IF NOT EXISTS idx_rma_records_created_at ON rma_records(created_at DESC);

-- 為 system_records 表添加複合索引
CREATE INDEX IF NOT EXISTS idx_system_records_serialnumber_current ON system_records(serialnumber, is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_system_records_created_at ON system_records(created_at DESC);

-- 添加統計信息
ANALYZE rma_records;
ANALYZE system_records;

-- 提交事務
COMMIT;

-- 驗證索引
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('rma_records', 'system_records')
ORDER BY tablename, indexname;

-- 回滾腳本
/*
BEGIN;
DROP INDEX IF EXISTS idx_rma_records_serialnumber;
DROP INDEX IF EXISTS idx_rma_records_status;
DROP INDEX IF EXISTS idx_rma_records_created_at;
DROP INDEX IF EXISTS idx_system_records_serialnumber_current;
DROP INDEX IF EXISTS idx_system_records_created_at;
COMMIT;
*/ 