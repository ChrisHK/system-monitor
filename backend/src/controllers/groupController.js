const pool = require('../db');
const { validateGroupData } = require('../utils/validation');

// 獲取所有群組
const getGroups = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                g.*,
                ARRAY_AGG(DISTINCT gsp.store_id) FILTER (WHERE gsp.store_id IS NOT NULL) as permitted_stores
            FROM groups g
            LEFT JOIN group_store_permissions gsp ON g.id = gsp.group_id
            GROUP BY g.id
            ORDER BY g.id
        `);
        
        res.json({
            success: true,
            groups: result.rows
        });
    } catch (error) {
        console.error('Error fetching groups:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch groups'
        });
    }
};

// 創建新群組
const createGroup = async (req, res) => {
    try {
        const { name, description, permitted_stores } = req.body;
        
        // 驗證群組數據
        const validationError = validateGroupData({ name, description, permitted_stores });
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
            if (permitted_stores && permitted_stores.length > 0) {
                const values = permitted_stores.map((store_id, index) => {
                    return `($1, $${index + 2})`;
                });
                
                const query = `
                    INSERT INTO group_store_permissions (group_id, store_id)
                    VALUES ${values.join(',')}
                `;
                
                await client.query(
                    query, 
                    [group.id, ...permitted_stores]
                );
            }

            await client.query('COMMIT');
            
            // 獲取完整的群組數據（包括商店權限）
            const finalGroup = await client.query(`
                SELECT 
                    g.*,
                    ARRAY_AGG(DISTINCT gsp.store_id) FILTER (WHERE gsp.store_id IS NOT NULL) as permitted_stores
                FROM groups g
                LEFT JOIN group_store_permissions gsp ON g.id = gsp.group_id
                WHERE g.id = $1
                GROUP BY g.id
            `, [group.id]);
            
            res.status(201).json({
                success: true,
                group: finalGroup.rows[0]
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
            error: error.message || 'Failed to create group'
        });
    }
};

// 更新群組
const updateGroup = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, permitted_stores } = req.body;

        // 驗證群組數據
        const validationError = validateGroupData({ name, description, permitted_stores });
        if (validationError) {
            return res.status(400).json({
                success: false,
                error: validationError
            });
        }

        // 檢查是否為系統預設群組
        const isSystemGroup = ['admin', 'user'].includes(name);
        if (isSystemGroup) {
            return res.status(403).json({
                success: false,
                error: 'Cannot modify system groups'
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
            if (permitted_stores && permitted_stores.length > 0) {
                const values = permitted_stores.map((store_id, index) => {
                    return `($1, $${index + 2})`;
                });
                
                const query = `
                    INSERT INTO group_store_permissions (group_id, store_id)
                    VALUES ${values.join(',')}
                `;
                
                await client.query(
                    query, 
                    [id, ...permitted_stores]
                );
            }

            await client.query('COMMIT');
            
            // 獲取完整的群組數據（包括商店權限）
            const finalGroup = await client.query(`
                SELECT 
                    g.*,
                    ARRAY_AGG(DISTINCT gsp.store_id) FILTER (WHERE gsp.store_id IS NOT NULL) as permitted_stores
                FROM groups g
                LEFT JOIN group_store_permissions gsp ON g.id = gsp.group_id
                WHERE g.id = $1
                GROUP BY g.id
            `, [id]);
            
            res.json({
                success: true,
                group: finalGroup.rows[0]
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
            error: error.message === 'Group not found' ? 'Group not found' : 'Failed to update group'
        });
    }
};

// 刪除群組
const deleteGroup = async (req, res) => {
    try {
        const { id } = req.params;

        // 檢查是否為系統預設群組
        const groupResult = await pool.query('SELECT name FROM groups WHERE id = $1', [id]);
        if (groupResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Group not found'
            });
        }

        const groupName = groupResult.rows[0].name;
        if (['admin', 'user'].includes(groupName)) {
            return res.status(403).json({
                success: false,
                error: 'Cannot delete system groups'
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

        // 開始事務
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 刪除現有權限
            await client.query('DELETE FROM group_permissions WHERE group_id = $1', [id]);

            // 添加新權限
            for (const perm of permissions) {
                await client.query(
                    'INSERT INTO group_permissions (group_id, permission_type, permission_value) VALUES ($1, $2, $3)',
                    [id, perm.type, perm.value]
                );
            }

            await client.query('COMMIT');
            
            res.json({
                success: true,
                message: 'Permissions updated successfully'
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
            error: 'Failed to update group permissions'
        });
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