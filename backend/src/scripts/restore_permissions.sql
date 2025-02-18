-- 開始事務
BEGIN;

-- 檢查當前權限狀態
DO $$
DECLARE
    admin_perms jsonb;
    user_perms jsonb;
BEGIN
    -- 檢查當前權限
    SELECT permissions INTO admin_perms
    FROM groups 
    WHERE name = 'admin' 
    LIMIT 1;
    
    SELECT permissions INTO user_perms
    FROM groups 
    WHERE name = 'user' 
    LIMIT 1;
    
    RAISE NOTICE 'Current permissions:';
    RAISE NOTICE '- Admin group: %', admin_perms;
    RAISE NOTICE '- User group: %', user_perms;
END $$;

-- 恢復權限設置
DO $$
DECLARE
    affected integer;
BEGIN
    -- 恢復 admin 組權限
    UPDATE groups 
    SET permissions = '["read", "write", "admin"]'::jsonb 
    WHERE name = 'admin';
    
    GET DIAGNOSTICS affected = ROW_COUNT;
    RAISE NOTICE '% admin group(s) updated', affected;
    
    -- 恢復 user 組權限
    UPDATE groups 
    SET permissions = '["read"]'::jsonb 
    WHERE name = 'user';
    
    GET DIAGNOSTICS affected = ROW_COUNT;
    RAISE NOTICE '% user group(s) updated', affected;
END $$;

-- 驗證恢復結果
DO $$
DECLARE
    admin_perms jsonb;
    user_perms jsonb;
BEGIN
    -- 檢查更新後的權限
    SELECT permissions INTO admin_perms
    FROM groups 
    WHERE name = 'admin' 
    LIMIT 1;
    
    SELECT permissions INTO user_perms
    FROM groups 
    WHERE name = 'user' 
    LIMIT 1;
    
    RAISE NOTICE 'Restored permissions:';
    RAISE NOTICE '- Admin group: %', admin_perms;
    RAISE NOTICE '- User group: %', user_perms;
    
    -- 驗證權限值
    IF admin_perms IS NULL OR admin_perms = '[]'::jsonb THEN
        RAISE EXCEPTION 'Admin permissions were not set correctly';
    END IF;
    
    IF user_perms IS NULL OR user_perms = '[]'::jsonb THEN
        RAISE EXCEPTION 'User permissions were not set correctly';
    END IF;
END $$;

-- 提交事務
COMMIT; 