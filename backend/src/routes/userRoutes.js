const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { auth, checkGroup } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');
const { ValidationError, AuthenticationError, NotFoundError } = require('../middleware/errorTypes');

// Login route
router.post('/login', catchAsync(async (req, res) => {
    console.log('Login attempt:', {
        username: req.body.username,
        hasPassword: !!req.body.password
    });

    const { username, password } = req.body;
    
    if (!username || !password) {
        console.log('Validation failed: missing credentials');
        throw new ValidationError('Username and password are required');
    }

    try {
        const result = await db.query(`
            SELECT 
                u.*,
                g.name as group_name,
                g.id as group_id,
                ARRAY_AGG(DISTINCT gsp.store_id) FILTER (WHERE gsp.store_id IS NOT NULL) as permitted_stores,
                ARRAY_AGG(DISTINCT gsp.features) FILTER (WHERE gsp.features IS NOT NULL) as store_features,
                jsonb_object_agg(gp.permission_type, gp.permission_value) FILTER (WHERE gp.permission_type IS NOT NULL) as main_permissions
            FROM users u
            LEFT JOIN groups g ON u.group_id = g.id
            LEFT JOIN group_store_permissions gsp ON g.id = gsp.group_id
            LEFT JOIN group_permissions gp ON g.id = gp.group_id
            WHERE u.username = $1 AND u.is_active = true
            GROUP BY u.id, g.name, g.id
        `, [username]);

        console.log('Database query result:', {
            hasRows: result.rows.length > 0,
            rowCount: result.rowCount
        });

        if (result.rows.length === 0) {
            console.log('Authentication failed: user not found');
            throw new AuthenticationError('Invalid credentials');
        }

        const user = result.rows[0];
        console.log('User found:', {
            id: user.id,
            username: user.username,
            hasPasswordHash: !!user.password_hash,
            group: user.group_name,
            main_permissions: user.main_permissions
        });

        const isMatch = await bcrypt.compare(password, user.password_hash);
        console.log('Password comparison result:', { isMatch });

        if (!isMatch) {
            console.log('Authentication failed: invalid password');
            throw new AuthenticationError('Invalid credentials');
        }

        // Update last login
        await db.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        console.log('JWT token generated successfully');

        const responseData = {
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                group_id: user.group_id,
                group_name: user.group_name,
                permitted_stores: user.permitted_stores || [],
                store_features: user.store_features || [],
                main_permissions: user.main_permissions || {}
            }
        };
        console.log('Login successful:', {
            userId: user.id,
            username: user.username,
            group: user.group_name,
            main_permissions: user.main_permissions
        });

        res.json(responseData);
    } catch (error) {
        console.error('Login error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        throw error;
    }
}));

// Get current user
router.get('/me', auth, catchAsync(async (req, res) => {
    // 獲取用戶的最新權限信息
    const result = await db.query(`
        SELECT 
            u.*,
            g.name as group_name,
            g.id as group_id,
            ARRAY_AGG(DISTINCT gsp.store_id) FILTER (WHERE gsp.store_id IS NOT NULL) as permitted_stores,
            ARRAY_AGG(DISTINCT gsp.features) FILTER (WHERE gsp.features IS NOT NULL) as store_features,
            jsonb_object_agg(gp.permission_type, gp.permission_value) FILTER (WHERE gp.permission_type IS NOT NULL) as main_permissions
        FROM users u
        LEFT JOIN groups g ON u.group_id = g.id
        LEFT JOIN group_store_permissions gsp ON g.id = gsp.group_id
        LEFT JOIN group_permissions gp ON g.id = gp.group_id
        WHERE u.id = $1
        GROUP BY u.id, g.name, g.id
    `, [req.user.id]);

    if (result.rows.length === 0) {
        throw new NotFoundError('User not found');
    }

    const user = result.rows[0];

    res.json({
        success: true,
        user: {
            id: user.id,
            username: user.username,
            group_id: user.group_id,
            group_name: user.group_name,
            permitted_stores: user.permitted_stores || [],
            store_features: user.store_features || [],
            main_permissions: user.main_permissions || {}
        }
    });
}));

// Create new user (admin group only)
router.post('/', auth, checkGroup(['admin']), catchAsync(async (req, res) => {
    const { username, password, group_id } = req.body;

    if (!username || !password || !group_id) {
        throw new ValidationError('Username, password and group are required');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.query(
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
    const result = await db.query(`
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
    
    const userResult = await db.query(updateUserQuery, [
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
    const updatedUser = await db.query(getUserQuery, [id]);

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
    const userResult = await db.query(
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
    await db.query(
        'DELETE FROM users WHERE id = $1 RETURNING id',
        [id]
    );

    res.json({
        success: true,
        message: 'User deleted successfully'
    });
}));

module.exports = router; 