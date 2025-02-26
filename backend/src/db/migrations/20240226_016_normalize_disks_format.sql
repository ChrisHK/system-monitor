-- 開始事務
BEGIN;

-- 更新數據格式
UPDATE system_records 
SET disks = 
    CASE 
        -- 處理 NULL 值
        WHEN disks IS NULL THEN NULL
        
        -- 處理空字符串
        WHEN disks = '' OR disks = '""' THEN NULL
        
        -- 處理帶引號的值 - 移除引號
        WHEN disks LIKE '"%"' OR disks LIKE '''%''' THEN 
            REPLACE(REPLACE(disks, '"', ''), '''', '')
            
        -- 其他情況保持原樣
        ELSE disks
    END;

-- 驗證數據
DO $$ 
BEGIN
    -- 檢查格式
    IF EXISTS (
        SELECT 1 
        FROM system_records 
        WHERE disks IS NOT NULL 
        AND (
            disks LIKE '%"%' OR 
            disks LIKE '%''%' OR 
            (disks NOT LIKE '%GB' AND disks NOT LIKE '%TB')
        )
    ) THEN
        RAISE EXCEPTION 'Found invalid disk format after conversion';
    END IF;
END $$;

COMMIT;

-- 回滾腳本
/*
BEGIN;
    -- 如果需要回滾，我們可以添加引號
    UPDATE system_records 
    SET disks = 
        CASE 
            WHEN disks IS NULL THEN NULL
            ELSE '"' || disks || '"'
        END;
COMMIT;
*/ 