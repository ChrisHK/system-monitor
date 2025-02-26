-- 開始事務
BEGIN;

-- 添加 solution 欄位到 store_rma 表
ALTER TABLE store_rma
ADD COLUMN IF NOT EXISTS solution TEXT;

-- 添加註釋
COMMENT ON COLUMN store_rma.solution IS 'RMA 解決方案';

-- 提交事務
COMMIT;

-- 回滾腳本
/*
BEGIN;
ALTER TABLE store_rma DROP COLUMN IF EXISTS solution;
COMMIT;
*/ 