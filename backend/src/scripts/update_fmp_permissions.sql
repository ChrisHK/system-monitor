-- 開始事務
BEGIN;

-- 更新 FMP 組的主要權限
UPDATE groups 
SET permissions = jsonb_build_object(
    'inventory', true,
    'inventory_ram', true,
    'inbound', true,
    'outbound', true
)
WHERE name = 'FMP';

-- 確保商店權限設置正確
INSERT INTO group_store_permissions (group_id, store_id, features)
SELECT 
    g.id,
    2,
    jsonb_build_object(
        'view', true,
        'basic', true,
        'inventory', true,
        'orders', true,
        'rma', true
    )
FROM groups g
WHERE g.name = 'FMP'
ON CONFLICT (group_id, store_id) 
DO UPDATE SET features = EXCLUDED.features;

-- 驗證更改
DO $$
DECLARE
    group_perms jsonb;
    store_perms jsonb;
BEGIN
    -- 檢查組權限
    SELECT permissions INTO group_perms
    FROM groups
    WHERE name = 'FMP';
    
    -- 檢查商店權限
    SELECT features INTO store_perms
    FROM group_store_permissions gsp
    JOIN groups g ON g.id = gsp.group_id
    WHERE g.name = 'FMP' AND store_id = 2;
    
    RAISE NOTICE 'FMP group permissions: %', group_perms;
    RAISE NOTICE 'FMP store 2 permissions: %', store_perms;
    
    -- 驗證主要權限
    IF group_perms IS NULL OR group_perms->>'inventory' IS NOT 'true' THEN
        RAISE EXCEPTION 'FMP group inventory permission not set correctly';
    END IF;
    
    -- 驗證商店權限
    IF store_perms IS NULL OR store_perms->>'inventory' IS NOT 'true' THEN
        RAISE EXCEPTION 'FMP store inventory permission not set correctly';
    END IF;
END $$;

-- 提交事務
COMMIT; 