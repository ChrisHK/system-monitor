const pool = require('../db');
const { validateGroupData } = require('../utils/validation');

// 獲取所有群組
const getGroups = async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // First get all groups
            const groupsResult = await client.query(`
                SELECT id, name, description
                FROM groups
                ORDER BY id
            `);

            // Get store permissions for each group
            const permissionsResult = await client.query(`
                SELECT group_id, store_id
                FROM group_store_permissions
                ORDER BY group_id, store_id
            `);

            // Get main permissions for each group
            const mainPermissionsResult = await client.query(`
                SELECT group_id, permission_type, permission_value
                FROM group_permissions
                ORDER BY group_id
            `);

            // Get all stores for admin
            const storesResult = await client.query(`
                SELECT id FROM stores
                ORDER BY id
            `);

            // Process the results
            const groups = groupsResult.rows.map(group => {
                // If this is the admin group, they have access to all stores and all permissions
                if (group.name === 'admin') {
                    return {
                        ...group,
                        permitted_stores: storesResult.rows.map(store => store.id),
                        store_permissions: storesResult.rows.reduce((acc, store) => {
                            acc[store.id] = {
                                inventory: true,
                                orders: true,
                                rma: true
                            };
                            return acc;
                        }, {}),
                        main_permissions: {
                            inventory: true,
                            inventory_ram: true
                        }
                    };
                }

                // For other groups, get their specific permissions
                const groupPermissions = permissionsResult.rows.filter(p => p.group_id === group.id);
                const groupMainPermissions = mainPermissionsResult.rows.filter(p => p.group_id === group.id);

                // Convert main permissions array to object
                const mainPermissions = groupMainPermissions.reduce((acc, p) => {
                    acc[p.permission_type] = p.permission_value;
                    return acc;
                }, {
                    inventory: false,
                    inventory_ram: false
                });

                return {
                    ...group,
                    permitted_stores: groupPermissions.map(p => p.store_id),
                    store_permissions: groupPermissions.reduce((acc, p) => {
                        acc[p.store_id] = {
                            inventory: true,
                            orders: true,
                            rma: true
                        };
                        return acc;
                    }, {}),
                    main_permissions: mainPermissions
                };
            });

            await client.query('COMMIT');
            
            res.json({
                success: true,
                groups
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch groups',
            details: error.message
        });
    }
};

// 創建新群組
const createGroup = async (req, res) => {
    try {
        const { name, description, store_permissions } = req.body;
        
        // 驗證群組數據
        const validationError = validateGroupData({ 
            name, 
            description, 
            store_permissions 
        });
        if (validationError) {
            return res.status(400).json({
                success: false,
                error: validationError
            });
        }

        // 檢查群組名稱是否已存在
        const existingGroup = await pool.query(
            'SELECT id FROM groups WHERE name = $1',
            [name]
        );

        if (existingGroup.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Group name "${name}" already exists`
            });
        }

        // 開始事務
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 創建群組
            const groupResult = await client.query(
                'INSERT INTO groups (name, description) VALUES ($1, $2) RETURNING *',
                [name, description]
            );
            const group = groupResult.rows[0];

            // 添加商店權限
            if (store_permissions && Object.keys(store_permissions).length > 0) {
                for (const [storeId, features] of Object.entries(store_permissions)) {
                    await client.query(
                        `INSERT INTO group_store_permissions (group_id, store_id, features)
                         VALUES ($1, $2, $3)`,
                        [group.id, parseInt(storeId), features]
                    );
                }
            }

            await client.query('COMMIT');
            
            // 獲取完整的群組數據
            const finalGroup = await getGroupWithPermissions(client, group.id);
            
            res.json({
                success: true,
                group: finalGroup
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create group',
            details: error.message
        });
    }
};

// 更新群組
const updateGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, store_permissions } = req.body;

        // 驗證群組數據
        const validationError = validateGroupData({ 
            name, 
            description, 
            store_permissions 
        });
        if (validationError) {
            return res.status(400).json({
                success: false,
                error: validationError
            });
        }

        // 檢查是否為系統預設群組
        const isSystemGroup = name === 'admin';
        if (isSystemGroup) {
            return res.status(403).json({
                success: false,
                error: 'Cannot modify admin group'
            });
        }

        // 開始事務
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 更新群組基本信息
            const groupResult = await client.query(
                'UPDATE groups SET name = $1, description = $2 WHERE id = $3 RETURNING *',
                [name, description, id]
            );

            if (groupResult.rows.length === 0) {
                throw new Error('Group not found');
            }

            // 更新商店權限
            // 先刪除現有的商店權限
            await client.query('DELETE FROM group_store_permissions WHERE group_id = $1', [id]);
            
            // 添加新的商店權限
            if (store_permissions && Object.keys(store_permissions).length > 0) {
                for (const [storeId, features] of Object.entries(store_permissions)) {
                    await client.query(
                        `INSERT INTO group_store_permissions (group_id, store_id, features)
                         VALUES ($1, $2, $3)`,
                        [id, parseInt(storeId), features]
                    );
                }
            }

            await client.query('COMMIT');
            
            // 獲取更新後的群組信息
            const finalGroupResult = await client.query(`
                SELECT g.id, g.name, g.description,
                    ARRAY_AGG(DISTINCT gsp.store_id) as permitted_stores,
                    json_object_agg(gsp.store_id, gsp.features) as store_permissions
                FROM groups g
                LEFT JOIN group_store_permissions gsp ON g.id = gsp.group_id
                WHERE g.id = $1
                GROUP BY g.id, g.name, g.description
            `, [id]);
            
            res.json({
                success: true,
                group: finalGroupResult.rows[0] || null
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error updating group:', error);
        res.status(error.message === 'Group not found' ? 404 : 500).json({
            success: false,
            error: error.message === 'Group not found' ? 'Group not found' : 'Failed to update group',
            details: error.message
        });
    }
};

// 刪除群組
const deleteGroup = async (req, res) => {
    try {
        const { id } = req.params;

        // 檢查群組是否存在
        const groupResult = await pool.query('SELECT name FROM groups WHERE id = $1', [id]);
        if (groupResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Group not found'
            });
        }

        const groupName = groupResult.rows[0].name;
        // 只保護 admin 群組不能刪除
        if (groupName === 'admin') {
            return res.status(403).json({
                success: false,
                error: 'Cannot delete admin group'
            });
        }

        // 刪除群組（權限會通過 CASCADE 自動刪除）
        await pool.query('DELETE FROM groups WHERE id = $1', [id]);
        
        res.json({
            success: true,
            message: 'Group deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting group:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete group'
        });
    }
};

// 獲取群組權限
const getGroupPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            'SELECT * FROM group_permissions WHERE group_id = $1',
            [id]
        );
        
        res.json({
            success: true,
            permissions: result.rows
        });
    } catch (error) {
        console.error('Error fetching group permissions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch group permissions'
        });
    }
};

// 更新群組權限
const updateGroupPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { permissions } = req.body;

        // 檢查群組是否存在
        const groupResult = await pool.query('SELECT name FROM groups WHERE id = $1', [id]);
        if (groupResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Group not found'
            });
        }

        // 檢查是否為系統預設群組
        const isSystemGroup = groupResult.rows[0].name === 'admin';
        if (isSystemGroup) {
            return res.status(403).json({
                success: false,
                error: 'Cannot modify admin group permissions'
            });
        }

        // 開始事務
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 刪除現有權限
            await client.query('DELETE FROM group_permissions WHERE group_id = $1', [id]);

            // 添加新權限
            for (const [permType, permValue] of Object.entries(permissions)) {
                await client.query(
                    'INSERT INTO group_permissions (group_id, permission_type, permission_value) VALUES ($1, $2, $3)',
                    [id, permType, permValue]
                );
            }

            await client.query('COMMIT');
            
            // 獲取更新後的權限
            const updatedPermissions = await client.query(
                'SELECT permission_type, permission_value FROM group_permissions WHERE group_id = $1',
                [id]
            );
            
            res.json({
                success: true,
                message: 'Permissions updated successfully',
                permissions: updatedPermissions.rows.reduce((acc, p) => {
                    acc[p.permission_type] = p.permission_value;
                    return acc;
                }, {})
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error updating group permissions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update group permissions',
            details: error.message
        });
    }
};

// 輔助函數：獲取群組及其權限
const getGroupWithPermissions = async (client, groupId) => {
    const result = await client.query(`
        SELECT 
            g.*,
            jsonb_object_agg(
                gsp.store_id::text, 
                gsp.features
            ) FILTER (WHERE gsp.store_id IS NOT NULL) as store_permissions
        FROM groups g
        LEFT JOIN group_store_permissions gsp ON g.id = gsp.group_id
        WHERE g.id = $1
        GROUP BY g.id
    `, [groupId]);
    
    return result.rows[0];
};

module.exports = {
    getGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    getGroupPermissions,
    updateGroupPermissions
}; 