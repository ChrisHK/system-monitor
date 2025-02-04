-- 群組商店權限表
CREATE TABLE IF NOT EXISTS group_store_permissions (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    features JSONB DEFAULT '{
        "inventory": false,
        "orders": false,
        "rma": false
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, store_id)
);

-- 刪除現有觸發器（如果存在）
DROP TRIGGER IF EXISTS update_group_store_permissions_updated_at ON group_store_permissions;

-- 創建觸發器以自動更新 updated_at
CREATE TRIGGER update_group_store_permissions_updated_at
    BEFORE UPDATE ON group_store_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 