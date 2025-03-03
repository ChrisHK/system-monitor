-- 檢查 group_store_permissions 表結構
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'group_store_permissions'
ORDER BY ordinal_position; 