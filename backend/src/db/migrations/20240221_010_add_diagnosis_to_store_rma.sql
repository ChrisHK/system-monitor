-- 開始事務
BEGIN;

-- 添加 diagnosis 欄位到 store_rma 表
ALTER TABLE store_rma
ADD COLUMN IF NOT EXISTS diagnosis TEXT;

-- 添加註釋
COMMENT ON COLUMN store_rma.diagnosis IS 'RMA 診斷結果';

-- 提交事務
COMMIT;

-- 回滾腳本
/*
BEGIN;
ALTER TABLE store_rma DROP COLUMN IF EXISTS diagnosis;
COMMIT;
*/ 