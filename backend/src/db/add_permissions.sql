-- 添加 permissions 列到 groups 表
ALTER TABLE groups 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;

-- 更新現有組的權限
UPDATE groups 
SET permissions = '["read"]'::jsonb 
WHERE name = 'user' AND permissions IS NULL;

UPDATE groups 
SET permissions = '["read", "write", "admin"]'::jsonb 
WHERE name = 'admin' AND permissions IS NULL; 