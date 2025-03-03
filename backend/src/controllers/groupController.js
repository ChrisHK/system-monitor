const pool = require('../db');
const { validateGroupData } = require('../utils/validation');
const cacheService = require('../services/cacheService');

// 獲取所有群組
const getGroups = async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // First get all groups
            const groupsResult = await client.query(`
                SELECT id, name, description, main_permissions
                FROM groups
                ORDER BY id
            `);

            // Get store permissions for each group
            const permissionsResult = await client.query(`
                SELECT gsp.group_id, gsp.store_id, gsp.permissions
                FROM group_store_permissions gsp
                ORDER BY gsp.group_id, gsp.store_id
            `);

            console.log('Raw permissions from database:', permissionsResult.rows);

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
                                rma: true,
                                outbound: true,
                                bulk_select: true
                            };
                            return acc;
                        }, {}),
                        main_permissions: {
                            inventory: true,
                            inventory_ram: true,
                            outbound: true,
                            inbound: true,
                            purchase_order: true,
                            tag_management: true,
                            bulk_select: true
                        }
                    };
                }

                // For other groups, get their specific permissions
                const groupPermissions = permissionsResult.rows.filter(p => p.group_id === group.id);

                // Convert store permissions
                const storePermissions = {};
                groupPermissions.forEach(p => {
                    if (p.store_id) {
                        try {
                            // 確保 permissions 是一個對象
                            const permissions = typeof p.permissions === 'string' 
                                ? JSON.parse(p.permissions) 
                                : p.permissions || {};
                            
                            console.log('Processing permissions for store', p.store_id, ':', permissions);
                            
                            storePermissions[p.store_id] = {
                                inventory: permissions.inventory === true,
                                orders: permissions.orders === true,
                                rma: permissions.rma === true,
                                outbound: permissions.outbound === true,
                                bulk_select: permissions.bulk_select === true
                            };
                        } catch (error) {
                            console.error(`Error parsing permissions for store ${p.store_id}:`, error);
                            storePermissions[p.store_id] = {
                                inventory: false,
                                orders: false,
                                rma: false,
                                outbound: false,
                                bulk_select: false
                            };
                        }
                    }
                });

                console.log('Processed store permissions:', storePermissions);

                // Ensure main_permissions is an object
                const mainPermissions = group.main_permissions || {};

                return {
                    ...group,
                    permitted_stores: [...new Set(groupPermissions.map(p => p.store_id).filter(Boolean))],
                    store_permissions: storePermissions,
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
        const { name, description, store_permissions, main_permissions } = req.body;
        
        console.log('Creating group with data:', {
            name,
            description,
            store_permissions,
            main_permissions,
            timestamp: new Date().toISOString()
        });

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

            // 創建群組，包含 main_permissions
            const mainPermissionsObj = typeof main_permissions === 'object' ? main_permissions : {};
            const groupResult = await client.query(
                `INSERT INTO groups (name, description, main_permissions) 
                VALUES ($1, $2, $3::jsonb) 
                RETURNING *`,
                [name, description, JSON.stringify(mainPermissionsObj)]
            );
            const group = groupResult.rows[0];

            // 添加商店權限
            if (Array.isArray(store_permissions) && store_permissions.length > 0) {
                // 從 store_permissions 中提取 store_ids
                const storeIds = store_permissions
                    .map(p => parseInt(p.store_id, 10))
                    .filter(id => !isNaN(id) && id > 0);

                if (storeIds.length > 0) {
                    // 驗證所有商店 ID 是否存在
                    const storesResult = await client.query(
                        'SELECT id FROM stores WHERE id = ANY($1::int[])',
                        [storeIds]
                    );

                    const validStoreIds = storesResult.rows.map(row => row.id);
                    
                    // 為每個有效的商店 ID 創建權限記錄
                    const insertPromises = store_permissions
                        .filter(p => validStoreIds.includes(parseInt(p.store_id, 10)))
                        .map(async (perm) => {
                            const permissionsObj = {
                                inventory: perm.inventory === '1' || perm.inventory === true,
                                orders: perm.orders === '1' || perm.orders === true,
                                rma: perm.rma === '1' || perm.rma === true,
                                outbound: perm.outbound === '1' || perm.outbound === true,
                                bulk_select: perm.bulk_select === '1' || perm.bulk_select === true
                            };

                            return client.query(`
                                INSERT INTO group_store_permissions 
                                (group_id, store_id, permissions, bulk_select)
                                VALUES ($1, $2, $3::jsonb, $4)
                            `, [group.id, perm.store_id, JSON.stringify(permissionsObj), permissionsObj.bulk_select]);
                        });

                    await Promise.all(insertPromises);
                }
            }

            await client.query('COMMIT');
            
            // 獲取完整的群組數據
            const updatedGroup = await getGroupWithPermissions(client, group.id);
            
            res.json({
                success: true,
                group: updatedGroup
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
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { name, description, main_permissions, store_permissions } = req.body;
        
        console.log('Updating group with data:', {
            id,
            name,
            description,
            main_permissions,
            store_permissions,
            timestamp: new Date().toISOString()
        });

        // Start transaction
        await client.query('BEGIN');

        // 1. Check if group exists and is not admin
        const groupCheck = await client.query(
            'SELECT id, name FROM groups WHERE id = $1',
            [id]
        );

        if (groupCheck.rows.length === 0) {
            throw new Error('Group not found');
        }

        if (groupCheck.rows[0].name === 'admin') {
            throw new Error('Cannot modify admin group');
        }

        // 2. Update group basic info and main permissions
        const mainPermissionsObj = typeof main_permissions === 'object' ? main_permissions : {};
        await client.query(`
            UPDATE groups 
            SET name = $1,
                description = $2,
                main_permissions = $3::jsonb,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
        `, [name, description, JSON.stringify(mainPermissionsObj), id]);

        // 3. Handle store permissions
        if (Array.isArray(store_permissions) && store_permissions.length > 0) {
            // Delete existing store permissions
            await client.query(
                'DELETE FROM group_store_permissions WHERE group_id = $1',
                [id]
            );

            // Insert new store permissions
            const insertPromises = store_permissions.map(async (perm) => {
                const permissionsObj = {
                    inventory: perm.inventory === '1' || perm.inventory === true,
                    orders: perm.orders === '1' || perm.orders === true,
                    outbound: perm.outbound === '1' || perm.outbound === true,
                    rma: perm.rma === '1' || perm.rma === true,
                    bulk_select: perm.bulk_select === '1' || perm.bulk_select === true
                };

                return client.query(`
                    INSERT INTO group_store_permissions 
                    (group_id, store_id, permissions, bulk_select)
                    VALUES ($1, $2, $3::jsonb, $4)
                `, [id, perm.store_id, JSON.stringify(permissionsObj), permissionsObj.bulk_select]);
            });

            await Promise.all(insertPromises);
        }

        // 4. Commit transaction
        await client.query('COMMIT');

        // 5. Clear cache
        await cacheService.clearStoreListCache(); // 清理商店列表緩存
        await cacheService.clearAllPermissionsCache(); // 清理所有權限相關緩存

        // 6. Get updated group data
        const updatedGroup = await getGroupWithPermissions(client, id);

        res.json({
            success: true,
            message: 'Group updated successfully',
            group: updatedGroup
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating group:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update group'
        });
    } finally {
        client.release();
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
        const { main_permissions, permitted_stores, store_permissions } = req.body;

        console.log('Received update request:', {
            groupId: id,
            main_permissions,
            permitted_stores,
            store_permissions
        });

        // 檢查 main_permissions 是否存在
        if (!main_permissions) {
            return res.status(400).json({
                success: false,
                error: 'Main permissions data is required'
            });
        }

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
        let finalStorePermissions = []; // 移到外層作用域

        try {
            await client.query('BEGIN');

            // 刪除現有權限
            await client.query('DELETE FROM group_permissions WHERE group_id = $1', [id]);
            await client.query('DELETE FROM group_store_permissions WHERE group_id = $1', [id]);

            // 添加新的主要權限
            const permissionEntries = Object.entries(main_permissions);
            if (permissionEntries.length > 0) {
                const insertValues = permissionEntries.map((_, index) => {
                    return `($1, $${index * 2 + 2}, $${index * 2 + 3})`;
                }).join(',');

                const flatParams = [id];
                permissionEntries.forEach(([permType, permValue]) => {
                    flatParams.push(permType, permValue);
                });

                await client.query(`
                    INSERT INTO group_permissions (group_id, permission_type, permission_value)
                    VALUES ${insertValues}
                `, flatParams);
            }

            // 添加新的商店權限
            if (store_permissions && store_permissions.length > 0) {
                // 從 store_permissions 中提取 store_ids
                const storeIds = store_permissions
                    .map(p => parseInt(p.store_id, 10))
                    .filter(id => !isNaN(id) && id > 0);

                if (storeIds.length > 0) {
                    // 驗證所有商店 ID 是否存在
                    const storesResult = await client.query(
                        'SELECT id FROM stores WHERE id = ANY($1::int[])',
                        [storeIds]
                    );

                    const validStoreIds = storesResult.rows.map(row => row.id);
                    
                    // 為每個有效的商店 ID 創建權限記錄
                    if (validStoreIds.length > 0) {
                        const storePermissionsMap = {};
                        store_permissions.forEach(p => {
                            if (p && typeof p === 'object' && validStoreIds.includes(parseInt(p.store_id, 10))) {
                                storePermissionsMap[p.store_id] = {
                                    inventory: p.inventory === '1' || p.inventory === true,
                                    orders: p.orders === '1' || p.orders === true,
                                    rma: p.rma === '1' || p.rma === true,
                                    outbound: p.outbound === '1' || p.outbound === true,
                                    bulk_select: p.bulk_select === '1' || p.bulk_select === true
                                };
                            }
                        });

                        const insertValues = validStoreIds.map((_, index) => {
                            return `($1, $${index * 2 + 2}, $${index * 2 + 3}::jsonb, $${index * 2 + 4})`;
                        }).join(',');

                        const flatParams = [id];
                        validStoreIds.forEach(storeId => {
                            const permissions = storePermissionsMap[storeId] || {
                                inventory: false,
                                orders: false,
                                rma: false,
                                outbound: false,
                                bulk_select: false
                            };
                            flatParams.push(
                                storeId, 
                                JSON.stringify(permissions),
                                permissions.bulk_select
                            );
                        });

                        console.log('Inserting store permissions:', {
                            insertValues,
                            flatParams,
                            storePermissionsMap
                        });

                        await client.query(`
                            INSERT INTO group_store_permissions (group_id, store_id, permissions, bulk_select)
                            VALUES ${insertValues}
                        `, flatParams);
                    }
                }
            }

            await client.query('COMMIT');
            
            // Clear cache
            await cacheService.clearStoreListCache(); // 清理商店列表緩存
            await cacheService.clearAllPermissionsCache(); // 清理所有權限相關緩存
            
            // 獲取更新後的權限
            const [mainPermissionsResult, storePermissionsResult] = await Promise.all([
                client.query(
                    'SELECT permission_type, permission_value FROM group_permissions WHERE group_id = $1',
                    [id]
                ),
                client.query(`
                    SELECT gsp.store_id, gsp.features
                    FROM group_store_permissions gsp
                    WHERE gsp.group_id = $1
                    ORDER BY gsp.store_id
                `, [id])
            ]);

            // 轉換 store_permissions 為前端期望的格式
            const processedStorePermissions = {};
            storePermissionsResult.rows.forEach(row => {
                const features = typeof row.features === 'string' 
                    ? JSON.parse(row.features) 
                    : row.features;
                
                processedStorePermissions[row.store_id] = {
                    inventory: features.inventory === true,
                    orders: features.orders === true,
                    rma: features.rma === true,
                    outbound: features.outbound === true,
                    bulk_select: features.bulk_select === true
                };

                console.log(`Processed permissions for store ${row.store_id}:`, {
                    raw: row.features,
                    processed: processedStorePermissions[row.store_id]
                });
            });

            // 確保所有 permitted_stores 都有對應的權限
            permitted_stores.forEach(storeId => {
                if (!processedStorePermissions[storeId]) {
                    processedStorePermissions[storeId] = {
                        inventory: false,
                        orders: false,
                        rma: false,
                        outbound: false,
                        bulk_select: false
                    };
                }
            });

            // 驗證更新是否成功
            const verifyResult = await client.query(`
                SELECT COUNT(*) as count
                FROM group_store_permissions
                WHERE group_id = $1
            `, [id]);

            console.log('Verification result:', {
                expectedCount: finalStorePermissions.length,
                actualCount: verifyResult.rows[0].count,
                processedPermissions: processedStorePermissions
            });

            const response = {
                success: true,
                message: 'Permissions updated successfully',
                main_permissions: mainPermissionsResult.rows.reduce((acc, p) => {
                    acc[p.permission_type] = p.permission_value;
                    return acc;
                }, {}),
                permitted_stores: permitted_stores,
                store_permissions: processedStorePermissions
            };

            console.log('Sending response:', JSON.stringify(response, null, 2));
            res.json(response);
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
    try {
        const groupResult = await client.query(`
            SELECT 
                g.id,
                g.name,
                g.description,
                g.main_permissions,
                COALESCE(
                    jsonb_object_agg(
                        gsp.store_id::text,
                        jsonb_build_object(
                            'inventory', (gsp.permissions->>'inventory')::boolean,
                            'orders', (gsp.permissions->>'orders')::boolean,
                            'rma', (gsp.permissions->>'rma')::boolean,
                            'outbound', (gsp.permissions->>'outbound')::boolean,
                            'bulk_select', gsp.bulk_select
                        )
                    ) FILTER (WHERE gsp.store_id IS NOT NULL),
                    '{}'::jsonb
                ) as store_permissions,
                COALESCE(
                    array_agg(DISTINCT gsp.store_id) FILTER (WHERE gsp.store_id IS NOT NULL),
                    ARRAY[]::integer[]
                ) as permitted_stores
            FROM groups g
            LEFT JOIN group_store_permissions gsp ON g.id = gsp.group_id
            WHERE g.id = $1
            GROUP BY g.id
        `, [groupId]);

        if (groupResult.rows.length === 0) {
            throw new Error('Group not found');
        }

        const group = groupResult.rows[0];

        // Ensure store_permissions is an object
        if (!group.store_permissions) {
            group.store_permissions = {};
        }

        // Ensure permitted_stores is an array
        if (!group.permitted_stores) {
            group.permitted_stores = [];
        }

        // Ensure main_permissions is an object
        if (!group.main_permissions) {
            group.main_permissions = {};
        }

        return group;
    } catch (error) {
        console.error('Error in getGroupWithPermissions:', error);
        throw error;
    }
};

module.exports = {
    getGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    getGroupPermissions,
    updateGroupPermissions
}; 