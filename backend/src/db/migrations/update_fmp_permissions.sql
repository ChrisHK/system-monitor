-- 更新 FMP 群組的主要權限
UPDATE group_permissions
SET permission_value = '{
    "inventory": true,
    "inventory_ram": false
}'::jsonb
WHERE group_id = (SELECT id FROM groups WHERE name = 'FMP')
AND permission_type = 'main_permissions';

-- 確認更新成功
SELECT g.name as group_name, gp.permission_value
FROM groups g
JOIN group_permissions gp ON g.id = gp.group_id
WHERE g.name = 'FMP'
AND gp.permission_type = 'main_permissions'; 