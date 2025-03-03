-- Start transaction
BEGIN;

-- Insert missing permissions for admin group (group_id = 1)
INSERT INTO group_permissions (group_id, permission_type, permission_value)
VALUES
    (1, 'inventory', 'true'),
    (1, 'inventory_ram', 'true'),
    (1, 'inbound', 'true'),
    (1, 'purchase_order', 'true'),
    (1, 'tag_management', 'true')
ON CONFLICT (group_id, permission_type) 
DO UPDATE SET 
    permission_value = 'true',
    updated_at = NOW();

-- Ensure outbound permission is set correctly
UPDATE group_permissions 
SET permission_value = 'true',
    updated_at = NOW()
WHERE group_id = 1 
AND permission_type = 'outbound';

-- Verify the permissions
SELECT g.name as group_name, 
       gp.permission_type, 
       gp.permission_value,
       gp.updated_at
FROM groups g
JOIN group_permissions gp ON g.id = gp.group_id
WHERE g.name = 'admin'
ORDER BY gp.permission_type;

COMMIT; 