const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { auth, checkGroup } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');
const { ValidationError, AuthenticationError, NotFoundError } = require('../middleware/errorTypes');
const { verifyToken } = require('../middleware/authMiddleware');

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
            SELECT 
                u.id, 
                u.username, 
                u.password_hash,
                u.group_id,
                u.is_active,
                g.name as group_name,
                g.permissions as group_permissions
            FROM users u
            LEFT JOIN groups g ON u.group_id = g.id
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

        // 創建 token
        const tokenPayload = {
            id: user.id,
            username: user.username,
            group_id: user.group_id,
            group_name: user.group_name,
            permissions: user.group_permissions
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
                [user.id]
            );
        } catch (err) {
            console.error('Error updating last login time:', {
                error: err.message,
                userId: user.id,
                timestamp: new Date().toISOString()
            });
            // 不中斷登錄流程
        }

        console.log('Login successful:', {
            userId: user.id,
            username: user.username,
            groupName: user.group_name,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                group_name: user.group_name,
                permissions: user.group_permissions
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