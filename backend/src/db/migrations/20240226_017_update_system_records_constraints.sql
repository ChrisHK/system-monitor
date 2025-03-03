-- 開始事務
BEGIN;

-- 1. 先移除現有的主鍵約束
ALTER TABLE system_records DROP CONSTRAINT IF EXISTS system_records_pkey;

-- 2. 添加序列號唯一約束
ALTER TABLE system_records 
    ADD CONSTRAINT system_records_serialnumber_key UNIQUE (serialnumber);

-- 3. 重新添加 id 作為主鍵
ALTER TABLE system_records 
    ADD CONSTRAINT system_records_pkey PRIMARY KEY (id);

-- 4. 添加序列號非空約束
ALTER TABLE system_records 
    ALTER COLUMN serialnumber SET NOT NULL;

-- 提交事務
COMMIT;

-- 回滾腳本
/*
BEGIN;
-- 移除序列號約束
ALTER TABLE system_records DROP CONSTRAINT IF EXISTS system_records_serialnumber_key;
ALTER TABLE system_records ALTER COLUMN serialnumber DROP NOT NULL;

-- 恢復原始主鍵約束
ALTER TABLE system_records DROP CONSTRAINT IF EXISTS system_records_pkey;
ALTER TABLE system_records ADD CONSTRAINT system_records_pkey PRIMARY KEY (id);

COMMIT;
*/ 