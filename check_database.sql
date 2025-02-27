-- 檢查數據
-- 1. 檢查 groups 表數據（包括權限）
SELECT 
    id,
    name,
    description,
    permissions,
    created_at,
    updated_at
FROM groups 
ORDER BY id;

-- 2. 檢查 stores 表數據
SELECT * FROM stores ORDER BY id;

-- 3. 檢查 group_store_permissions 表結構
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'group_store_permissions'
ORDER BY ordinal_position;

-- 4. 如果 group_store_permissions 表存在，檢查其數據
SELECT 
    gsp.group_id,
    g.name as group_name,
    gsp.store_id,
    s.name as store_name,
    gsp.features,
    gsp.created_at
FROM group_store_permissions gsp
JOIN groups g ON gsp.group_id = g.id
JOIN stores s ON gsp.store_id = s.id
ORDER BY gsp.group_id, gsp.store_id;

-- 5. 綜合查詢：檢查群組及其權限
SELECT 
    g.id as group_id,
    g.name as group_name,
    g.description,
    g.permissions as main_permissions,
    json_object_agg(
        s.id,
        json_build_object(
            'store_name', s.name,
            'permissions', gsp.features
        )
    ) FILTER (WHERE s.id IS NOT NULL) as store_permissions
FROM groups g
LEFT JOIN group_store_permissions gsp ON g.id = gsp.group_id
LEFT JOIN stores s ON gsp.store_id = s.id
GROUP BY g.id, g.name, g.description, g.permissions
ORDER BY g.id; 