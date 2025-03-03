-- backend/src/db/migrations/20240328_015_add_bulk_select_permission.sql

-- Description: Add bulk select permission to groups and group_store_permissions tables
-- Part 1: Schema changes

-- 首先回滾任何可能存在的未完成事務
ROLLBACK;

BEGIN;

-- 1. 創建 schema_migrations 表（如果不存在）
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 添加批量選擇權限到 group_store_permissions 表
ALTER TABLE group_store_permissions
ADD COLUMN IF NOT EXISTS bulk_select BOOLEAN DEFAULT false;

-- 3. 添加註釋
COMMENT ON COLUMN group_store_permissions.bulk_select IS 'Permission to use bulk select feature in store inventory';

COMMIT;

-- Part 2: Permissions and triggers
BEGIN;

-- 1. 更新 admin 群組權限
UPDATE groups
SET main_permissions = CASE 
    WHEN main_permissions IS NULL THEN '{"bulk_select": true}'::jsonb
    ELSE main_permissions || '{"bulk_select": true}'::jsonb
END
WHERE name = 'admin';

-- 2. 創建權限更新函數
CREATE OR REPLACE FUNCTION update_store_bulk_select_permission()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE group_store_permissions
    SET bulk_select = COALESCE((NEW.main_permissions->>'bulk_select')::boolean, false)
    WHERE group_id = NEW.id;
    RETURN NEW;
EXCEPTION 
    WHEN others THEN
        RAISE NOTICE 'Error in trigger function: %', SQLERRM;
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. 創建觸發器
DROP TRIGGER IF EXISTS sync_bulk_select_permission ON groups;
CREATE TRIGGER sync_bulk_select_permission
AFTER UPDATE OF main_permissions ON groups
FOR EACH ROW
WHEN (
    (OLD.main_permissions->>'bulk_select') IS DISTINCT FROM 
    (NEW.main_permissions->>'bulk_select')
)
EXECUTE PROCEDURE update_store_bulk_select_permission();

-- 4. 創建回滾函數
CREATE OR REPLACE FUNCTION rollback_20240328_015()
RETURNS void AS $$
BEGIN
    DROP TRIGGER IF EXISTS sync_bulk_select_permission ON groups;
    DROP FUNCTION IF EXISTS update_store_bulk_select_permission();
    
    UPDATE groups
    SET main_permissions = main_permissions - 'bulk_select'
    WHERE main_permissions ? 'bulk_select';
    
    ALTER TABLE group_store_permissions DROP COLUMN IF EXISTS bulk_select;
    DELETE FROM schema_migrations WHERE version = '20240328_015';
EXCEPTION 
    WHEN others THEN
        RAISE NOTICE 'Error in rollback function: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 5. 添加版本控制
INSERT INTO schema_migrations (version, description)
VALUES ('20240328_015', 'Add bulk select permission')
ON CONFLICT (version) DO UPDATE 
SET description = EXCLUDED.description;

COMMIT; 