-- 添加 features 欄位到 group_store_permissions 表
ALTER TABLE group_store_permissions
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{"inventory": false, "orders": false, "rma": false}'::jsonb;

-- 更新現有記錄的 features 欄位
UPDATE group_store_permissions
SET features = '{"inventory": true, "orders": true, "rma": true}'::jsonb
WHERE features IS NULL; 