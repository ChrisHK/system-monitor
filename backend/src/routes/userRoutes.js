const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { auth, checkGroup } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');
const { ValidationError, AuthenticationError, NotFoundError } = require('../middleware/errorTypes');
const { verifyToken } = require('../middleware/authMiddleware');

// Add this function at the top after imports
const ensureAdminPermissions = (user) => {
    if (user.group_name === 'admin') {
        console.log('Ensuring admin permissions for user:', user.username);
        
        // Get all store IDs from permitted_stores
        const storeIds = user.permitted_stores || [];
        
        // Create store permissions object with full access for all stores
        const storePermissions = {};
        storeIds.forEach(storeId => {
            storePermissions[storeId] = {
                inventory: true,
                orders: true,
                rma: true,
                outbound: true
            };
        });

        const processedUser = {
            ...user,
            permissions: ['read', 'write', 'admin'],
            main_permissions: {
                inventory: true,
                inventory_ram: true,
                outbound: true,
                inbound: true,
                purchase_order: true,
                tag_management: true
            },
            store_permissions: storePermissions
        };

        console.log('Processed admin permissions:', {
            username: processedUser.username,
            mainPermissions: processedUser.main_permissions,
            storePermissions: processedUser.store_permissions,
            permittedStores: processedUser.permitted_stores
        });

        return processedUser;
    }
    return user;
};

// Login route - no auth required
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 驗證請求數據
        if (!username || !password) {
            console.error('Login failed: Missing credentials', {
                timestamp: new Date().toISOString()
            });
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }

        // 查詢用戶信息
        const userQuery = `
            WITH store_permissions AS (
                SELECT 
                    gsp.group_id,
                    jsonb_object_agg(
                        gsp.store_id::text,
                        jsonb_build_object(
                            'inventory', COALESCE(gsp.features->>'inventory', 'false')::boolean,
                            'orders', COALESCE(gsp.features->>'orders', 'false')::boolean,
                            'rma', COALESCE(gsp.features->>'rma', 'false')::boolean,
                            'outbound', COALESCE(gsp.features->>'outbound', 'false')::boolean
                        )
                    ) as store_permissions,
                    array_agg(DISTINCT gsp.store_id) as permitted_stores
                FROM group_store_permissions gsp
                GROUP BY gsp.group_id
            )
            SELECT 
                u.id, 
                u.username, 
                u.password_hash,
                u.group_id,
                u.is_active,
                g.name as group_name,
                g.permissions,
                sp.permitted_stores,
                sp.store_permissions,
                jsonb_build_object(
                    'inventory', CASE 
                        WHEN g.name = 'admin' THEN true 
                        WHEN gp_inv.permission_value::text = 'true' THEN true 
                        ELSE false 
                    END,
                    'inventory_ram', CASE 
                        WHEN g.name = 'admin' THEN true 
                        WHEN gp_ram.permission_value::text = 'true' THEN true 
                        ELSE false 
                    END,
                    'outbound', CASE 
                        WHEN g.name = 'admin' THEN true 
                        WHEN gp_out.permission_value::text = 'true' THEN true 
                        ELSE false 
                    END,
                    'inbound', CASE 
                        WHEN g.name = 'admin' THEN true 
                        WHEN gp_in.permission_value::text = 'true' THEN true 
                        ELSE false 
                    END,
                    'purchase_order', CASE 
                        WHEN g.name = 'admin' THEN true 
                        WHEN gp_po.permission_value::text = 'true' THEN true 
                        ELSE false 
                    END,
                    'tag_management', CASE 
                        WHEN g.name = 'admin' THEN true 
                        WHEN gp_tag.permission_value::text = 'true' THEN true 
                        ELSE false 
                    END
                ) as main_permissions
            FROM users u
            LEFT JOIN groups g ON u.group_id = g.id
            LEFT JOIN store_permissions sp ON g.id = sp.group_id
            LEFT JOIN group_permissions gp_inv ON g.id = gp_inv.group_id AND gp_inv.permission_type = 'inventory'
            LEFT JOIN group_permissions gp_ram ON g.id = gp_ram.group_id AND gp_ram.permission_type = 'inventory_ram'
            LEFT JOIN group_permissions gp_out ON g.id = gp_out.group_id AND gp_out.permission_type = 'outbound'
            LEFT JOIN group_permissions gp_in ON g.id = gp_in.group_id AND gp_in.permission_type = 'inbound'
            LEFT JOIN group_permissions gp_po ON g.id = gp_po.group_id AND gp_po.permission_type = 'purchase_order'
            LEFT JOIN group_permissions gp_tag ON g.id = gp_tag.group_id AND gp_tag.permission_type = 'tag_management'
            WHERE u.username = $1
        `;
        
        const result = await query(userQuery, [username]);
        
        // 檢查用戶是否存在
        if (result.rows.length === 0) {
            console.error('Login failed: User not found:', {
                username,
                timestamp: new Date().toISOString()
            });
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        const user = result.rows[0];

        // 檢查用戶是否啟用
        if (!user.is_active) {
            console.error('Login failed: User account is disabled:', {
                username,
                timestamp: new Date().toISOString()
            });
            return res.status(401).json({
                success: false,
                error: 'Account is disabled'
            });
        }

        // 驗證密碼
        let isValidPassword;
        try {
            isValidPassword = await bcrypt.compare(password, user.password_hash);
        } catch (err) {
            console.error('Password comparison error:', {
                error: err.message,
                username,
                timestamp: new Date().toISOString()
            });
            throw new Error('Password verification failed');
        }

        if (!isValidPassword) {
            console.error('Login failed: Invalid password:', {
                username,
                timestamp: new Date().toISOString()
            });
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Apply admin permissions if needed
        const processedUser = ensureAdminPermissions(user);

        // 創建 token
        const tokenPayload = {
            id: processedUser.id,
            username: processedUser.username,
            group_id: processedUser.group_id,
            group_name: processedUser.group_name,
            permissions: processedUser.permissions || [],
            main_permissions: processedUser.main_permissions,
            store_permissions: processedUser.store_permissions || {},
            permitted_stores: processedUser.permitted_stores || []
        };

        let token;
        try {
            token = jwt.sign(
                tokenPayload,
                process.env.JWT_SECRET,
                { 
                    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
                    algorithm: process.env.JWT_ALGORITHM || 'HS256'
                }
            );
        } catch (err) {
            console.error('Token generation error:', {
                error: err.message,
                username,
                timestamp: new Date().toISOString()
            });
            throw new Error('Failed to generate authentication token');
        }

        // 更新最後登錄時間
        try {
            await query(
                'UPDATE users SET last_login = NOW() WHERE id = $1',
                [processedUser.id]
            );
        } catch (err) {
            console.error('Error updating last login time:', {
                error: err.message,
                userId: processedUser.id,
                timestamp: new Date().toISOString()
            });
            // 不中斷登錄流程
        }

        console.log('Login successful:', {
            userId: processedUser.id,
            username: processedUser.username,
            groupName: processedUser.group_name,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            token,
            user: {
                id: processedUser.id,
                username: processedUser.username,
                group_name: processedUser.group_name,
                permissions: processedUser.permissions || [],
                main_permissions: processedUser.main_permissions,
                store_permissions: processedUser.store_permissions || {},
                permitted_stores: processedUser.permitted_stores || []
            }
        });
    } catch (error) {
        console.error('Login error:', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        // 根據錯誤類型返回適當的錯誤信息
        if (error.message === 'Password verification failed') {
            return res.status(500).json({
                success: false,
                error: 'Authentication service error'
            });
        }

        if (error.message === 'Failed to generate authentication token') {
            return res.status(500).json({
                success: false,
                error: 'Token generation failed'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error during login'
        });
    }
});

// Get current user - requires auth
router.get('/me', verifyToken, (req, res) => {
    try {
        // User info is already in req.user from verifyToken middleware
        res.json({
            success: true,
            user: req.user
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get user info'
        });
    }
});

// Logout route - requires auth
router.post('/logout', verifyToken, (req, res) => {
    try {
        // Since we're using JWT, we don't need to do anything server-side
        // The client should remove the token
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed'
        });
    }
});

// Create new user (admin group only)
router.post('/', auth, checkGroup(['admin']), catchAsync(async (req, res) => {
    const { username, password, group_id } = req.body;

    if (!username || !password || !group_id) {
        throw new ValidationError('Username, password and group are required');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
        'INSERT INTO users (username, password_hash, group_id) VALUES ($1, $2, $3) RETURNING id',
        [username, passwordHash, group_id]
    );

    res.status(201).json({
        success: true,
        message: 'User created successfully',
        userId: result.rows[0].id
    });
}));

// Get all users (admin group only)
router.get('/', auth, checkGroup(['admin']), catchAsync(async (req, res) => {
    const result = await query(`
        SELECT 
            u.id, 
            u.username, 
            u.is_active, 
            u.last_login, 
            u.group_id,
            g.name as group_name
        FROM users u
        LEFT JOIN groups g ON u.group_id = g.id
        ORDER BY u.created_at DESC
    `);

    res.json({
        success: true,
        users: result.rows
    });
}));

// Update user (admin group only)
router.put('/:id', auth, checkGroup(['admin']), catchAsync(async (req, res) => {
    const { id } = req.params;
    const { username, group_id } = req.body;

    if (!username || !group_id) {
        throw new ValidationError('Username and group are required');
    }

    // Update user data
    const updateUserQuery = `
        UPDATE users 
        SET username = $1, 
            group_id = $2
        WHERE id = $3 
        RETURNING *
    `;
    
    const userResult = await query(updateUserQuery, [
        username,
        group_id,
        id
    ]);

    if (userResult.rows.length === 0) {
        throw new NotFoundError('User not found');
    }

    // Get the updated user with group name
    const getUserQuery = `
        SELECT u.*, g.name as group_name
        FROM users u
        LEFT JOIN groups g ON u.group_id = g.id
        WHERE u.id = $1
    `;
    const updatedUser = await query(getUserQuery, [id]);

    res.json({ 
        success: true, 
        message: 'User updated successfully',
        user: updatedUser.rows[0]
    });
}));

// Delete user (admin group only)
router.delete('/:id', auth, checkGroup(['admin']), catchAsync(async (req, res) => {
    const { id } = req.params;

    // First check if this is the admin user
    const userResult = await query(
        'SELECT username FROM users WHERE id = $1',
        [id]
    );

    if (userResult.rows.length === 0) {
        throw new NotFoundError('User not found');
    }

    if (userResult.rows[0].username === 'admin') {
        throw new ValidationError('Admin user cannot be deleted');
    }

    // Delete the user
    await query(
        'DELETE FROM users WHERE id = $1 RETURNING id',
        [id]
    );

    res.json({
        success: true,
        message: 'User deleted successfully'
    });
}));

module.exports = router; 