-- 開始事務
BEGIN;

-- 檢查並添加 permissions 列
DO $$
BEGIN
    -- 檢查表是否存在
    IF EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'groups'
    ) THEN
        -- 檢查列是否存在
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'groups' 
            AND column_name = 'permissions'
        ) THEN
            ALTER TABLE groups 
            ADD COLUMN permissions JSONB DEFAULT '[]'::jsonb;
            
            RAISE NOTICE 'Added permissions column to groups table';
        ELSE
            RAISE NOTICE 'Permissions column already exists';
        END IF;
    ELSE
        RAISE EXCEPTION 'Groups table does not exist';
    END IF;
END $$;

-- 更新用戶組權限
DO $$
DECLARE
    affected integer;
BEGIN
    -- 更新 user 組權限
    UPDATE groups 
    SET permissions = '["read"]'::jsonb 
    WHERE name = 'user' 
    AND (permissions IS NULL OR permissions = '[]'::jsonb);
    
    GET DIAGNOSTICS affected = ROW_COUNT;
    RAISE NOTICE '% user group(s) updated', affected;
    
    -- 更新 admin 組權限
    UPDATE groups 
    SET permissions = '["read", "write", "admin"]'::jsonb 
    WHERE name = 'admin' 
    AND (permissions IS NULL OR permissions = '[]'::jsonb);
    
    GET DIAGNOSTICS affected = ROW_COUNT;
    RAISE NOTICE '% admin group(s) updated', affected;
    
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE EXCEPTION 'Insufficient privileges to update groups table';
END $$;

-- 驗證更改
DO $$
DECLARE
    col_exists boolean;
    admin_perms jsonb;
    user_perms jsonb;
BEGIN
    -- 檢查列是否存在
    SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'groups' 
        AND column_name = 'permissions'
    ) INTO col_exists;
    
    IF col_exists THEN
        -- 檢查權限值
        SELECT permissions INTO admin_perms
        FROM groups 
        WHERE name = 'admin' 
        LIMIT 1;
        
        SELECT permissions INTO user_perms
        FROM groups 
        WHERE name = 'user' 
        LIMIT 1;
        
        RAISE NOTICE 'Verification results:';
        RAISE NOTICE '- Permissions column exists: %', col_exists;
        RAISE NOTICE '- Admin permissions: %', admin_perms;
        RAISE NOTICE '- User permissions: %', user_perms;
    ELSE
        RAISE EXCEPTION 'Permissions column was not created successfully';
    END IF;
END $$;

-- 提交事務
COMMIT; 