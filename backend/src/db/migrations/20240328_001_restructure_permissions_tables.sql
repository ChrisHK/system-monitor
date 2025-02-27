-- Description: Restructure permissions tables to better handle group permissions
BEGIN;

-- 1. 重建 groups 表
CREATE TABLE IF NOT EXISTS groups_new (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    main_permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 重建 group_store_permissions 表
CREATE TABLE IF NOT EXISTS group_store_permissions_new (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups_new(id) ON DELETE CASCADE,
    store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, store_id)
);

-- 3. 遷移數據
INSERT INTO groups_new (id, name, description, main_permissions)
SELECT 
    id, 
    name, 
    description,
    CASE 
        WHEN permissions IS NULL THEN '{}'::jsonb
        ELSE permissions::jsonb
    END
FROM groups;

INSERT INTO group_store_permissions_new (group_id, store_id, permissions)
SELECT 
    group_id,
    store_id,
    features
FROM group_store_permissions;

-- 4. 刪除舊表並重命名新表
DROP TABLE IF EXISTS group_store_permissions;
DROP TABLE IF EXISTS groups CASCADE;

ALTER TABLE groups_new RENAME TO groups;
ALTER TABLE group_store_permissions_new RENAME TO group_store_permissions;

-- 5. 創建索引
CREATE INDEX idx_group_store_permissions_group_id ON group_store_permissions(group_id);
CREATE INDEX idx_group_store_permissions_store_id ON group_store_permissions(store_id);

-- 6. 添加觸發器更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_groups_updated_at
    BEFORE UPDATE ON groups
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_group_store_permissions_updated_at
    BEFORE UPDATE ON group_store_permissions
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

COMMIT; 