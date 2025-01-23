-- 添加主要權限到 group_permissions 表
INSERT INTO group_permissions (group_id, permission_type, permission_value)
SELECT 
    g.id,
    'main_permissions',
    '{
        "inventory": false,
        "inventory_ram": false
    }'::jsonb
FROM groups g
WHERE NOT EXISTS (
    SELECT 1 
    FROM group_permissions gp 
    WHERE gp.group_id = g.id 
    AND gp.permission_type = 'main_permissions'
)
ON CONFLICT (group_id, permission_type) DO UPDATE
SET permission_value = EXCLUDED.permission_value;

-- 為 admin 群組啟用所有主要權限
UPDATE group_permissions
SET permission_value = '{
    "inventory": true,
    "inventory_ram": true
}'::jsonb
WHERE group_id = (SELECT id FROM groups WHERE name = 'admin')
AND permission_type = 'main_permissions'; 