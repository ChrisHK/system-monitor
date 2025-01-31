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
                SELECT gsp.group_id, gsp.store_id, gsp.features
                FROM group_store_permissions gsp
                ORDER BY gsp.group_id, gsp.store_id
            `);

            console.log('Raw permissions from database:', permissionsResult.rows);

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
                                rma: true,
                                outbound: true
                            };
                            return acc;
                        }, {}),
                        main_permissions: {
                            inventory: true,
                            inventory_ram: true,
                            outbound: true,
                            inbound: true
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
                    inventory_ram: false,
                    outbound: false,
                    inbound: false
                });

                // Convert store permissions
                const storePermissions = {};
                groupPermissions.forEach(p => {
                    if (p.store_id) {
                        try {
                            // 確保 features 是一個對象
                            const features = typeof p.features === 'string' 
                                ? JSON.parse(p.features) 
                                : p.features || {};
                            
                            console.log('Processing features for store', p.store_id, ':', features);
                            
                            storePermissions[p.store_id] = {
                                inventory: features.inventory === true,
                                orders: features.orders === true,
                                rma: features.rma === true,
                                outbound: features.outbound === true
                            };
                        } catch (error) {
                            console.error(`Error parsing features for store ${p.store_id}:`, error);
                            storePermissions[p.store_id] = {
                                inventory: false,
                                orders: false,
                                rma: false,
                                outbound: false
                            };
                        }
                    }
                });

                console.log('Processed store permissions:', storePermissions);

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
            if (store_permissions && store_permissions.length > 0) {
                const insertValues = store_permissions.map((p, index) => {
                    return `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3}::jsonb)`;
                }).join(',');
                
                const flatParams = store_permissions.reduce((acc, p) => {
                    // 提取權限數據
                    const features = {
                        inventory: p.inventory === '1',
                        orders: p.orders === '1',
                        rma: p.rma === '1',
                        outbound: p.outbound === '1'
                    };
                    return [...acc, group.id, p.store_id, JSON.stringify(features)];
                }, []);

                await client.query(`
                    INSERT INTO group_store_permissions (group_id, store_id, features)
                    VALUES ${insertValues}
                `, flatParams);
            }

            await client.query('COMMIT');
            
            // 獲取完整的群組數據
            const finalGroupResult = await client.query(`
                SELECT g.id, g.name, g.description,
                    ARRAY_AGG(DISTINCT gsp.store_id) as permitted_stores,
                    jsonb_object_agg(
                        gsp.store_id::text, 
                        gsp.features
                    ) FILTER (WHERE gsp.store_id IS NOT NULL) as store_permissions
                FROM groups g
                LEFT JOIN group_store_permissions gsp ON g.id = gsp.group_id
                WHERE g.id = $1
                GROUP BY g.id, g.name, g.description
            `, [group.id]);
            
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
        const { name, description } = req.body;

        // 驗證群組數據
        const validationError = validateGroupData({ 
            name, 
            description
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

            await client.query('COMMIT');
            
            // 獲取完整的群組信息
            const [mainPermissions, storePermissions] = await Promise.all([
                client.query(
                    'SELECT permission_type, permission_value FROM group_permissions WHERE group_id = $1',
                    [id]
                ),
                client.query(
                    'SELECT store_id, features FROM group_store_permissions WHERE group_id = $1',
                    [id]
                )
            ]);

            const response = {
                success: true,
                group: {
                    ...groupResult.rows[0],
                    main_permissions: mainPermissions.rows.reduce((acc, p) => {
                        acc[p.permission_type] = p.permission_value;
                        return acc;
                    }, {}),
                    permitted_stores: storePermissions.rows.map(p => p.store_id),
                    store_permissions: storePermissions.rows.reduce((acc, p) => {
                        acc[p.store_id] = p.features;
                        return acc;
                    }, {})
                }
            };

            console.log('Sending response:', response);
            res.json(response);
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
                // 驗證 store_id 是否存在於 permitted_stores 中
                const validStorePermissions = store_permissions.filter(permission => 
                    permitted_stores.includes(Number(permission.store_id))
                );

                if (validStorePermissions.length > 0) {
                    // 先檢查所有商店是否存在
                    const storeIds = validStorePermissions.map(p => Number(p.store_id));
                    const storesResult = await client.query(
                        'SELECT id FROM stores WHERE id = ANY($1::int[])',
                        [storeIds]
                    );

                    const validStoreIds = storesResult.rows.map(row => row.id);
                    finalStorePermissions = validStorePermissions.filter(permission =>
                        validStoreIds.includes(Number(permission.store_id))
                    );

                    if (finalStorePermissions.length > 0) {
                        const storeValues = finalStorePermissions.map((_, index) => {
                            return `($1, $${index * 2 + 2}, $${index * 2 + 3}::jsonb)`;
                        }).join(',');

                        const flatParams = [id];
                        finalStorePermissions.forEach(permission => {
                            const features = {
                                inventory: permission.inventory === '1',
                                orders: permission.orders === '1',
                                rma: permission.rma === '1',
                                outbound: permission.outbound === '1'
                            };
                            flatParams.push(Number(permission.store_id), JSON.stringify(features));
                        });

                        console.log('Inserting store permissions:', {
                            storeValues,
                            flatParams,
                            finalStorePermissions
                        });

                        await client.query(`
                            INSERT INTO group_store_permissions (group_id, store_id, features)
                            VALUES ${storeValues}
                        `, flatParams);

                        // 驗證插入是否成功
                        const insertedPermissions = await client.query(`
                            SELECT store_id, features
                            FROM group_store_permissions
                            WHERE group_id = $1 AND store_id = ANY($2::int[])
                        `, [id, storeIds]);

                        console.log('Inserted permissions:', insertedPermissions.rows);
                    }
                }
            }

            await client.query('COMMIT');
            
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
                    outbound: features.outbound === true
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
                        outbound: false
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