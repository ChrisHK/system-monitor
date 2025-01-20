const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { auth, checkRole } = require('../middleware/auth');

// Login route
router.post('/login', async (req, res) => {
    try {
        console.log('Login attempt for user:', req.body.username);
        
        const { username, password } = req.body;
        if (!username || !password) {
            console.log('Missing credentials');
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }

        const result = await pool.query(
            'SELECT users.*, roles.name as role_name FROM users JOIN roles ON users.role_id = roles.id WHERE username = $1 AND is_active = true',
            [username]
        );

        if (result.rows.length === 0) {
            console.log('User not found:', username);
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            console.log('Invalid password for user:', username);
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Update last login
        await pool.query(
            'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        console.log('Login successful for user:', username);

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role_name
            }
        });
    } catch (error) {
        console.error('Login error details:', {
            error: error.message,
            stack: error.stack,
            user: req.body.username
        });
        res.status(500).json({
            success: false,
            error: 'Error during login'
        });
    }
});

// Get current user
router.get('/me', auth, async (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role_name,
            group_id: req.user.group_id,
            group_name: req.user.group_name,
            permitted_stores: req.user.permitted_stores || []
        }
    });
});

// Create new user (admin only)
router.post('/', auth, checkRole(['admin']), async (req, res) => {
    try {
        const { username, password, role } = req.body;

        // Get role id
        const roleResult = await pool.query(
            'SELECT id FROM roles WHERE name = $1',
            [role]
        );

        if (roleResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid role'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3) RETURNING id',
            [username, passwordHash, roleResult.rows[0].id]
        );

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            userId: result.rows[0].id
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            error: 'Error creating user'
        });
    }
});

// Get all users (admin only)
router.get('/', auth, checkRole(['admin']), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.id, 
                u.username, 
                u.is_active, 
                u.last_login, 
                u.group_id,
                r.name as role,
                g.name as group_name
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN groups g ON u.group_id = g.id
            ORDER BY u.created_at DESC
        `);

        res.json({
            success: true,
            users: result.rows
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            error: 'Error fetching users'
        });
    }
});

// Update user (admin only)
router.put('/:id', auth, checkRole(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { username, role, group_id } = req.body;

        // Get role id from roles table
        const roleResult = await pool.query(
            'SELECT id FROM roles WHERE name = $1',
            [role]
        );

        if (roleResult.rows.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid role' 
            });
        }

        // Update user data
        const updateUserQuery = `
            UPDATE users 
            SET username = $1, 
                role_id = $2,
                group_id = $3
            WHERE id = $4 
            RETURNING *
        `;
        
        const userResult = await pool.query(updateUserQuery, [
            username,
            roleResult.rows[0].id,
            group_id,
            id
        ]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Get the updated user with role name
        const getUserQuery = `
            SELECT u.*, r.name as role
            FROM users u
            JOIN roles r ON u.role_id = r.id
            WHERE u.id = $1
        `;
        const updatedUser = await pool.query(getUserQuery, [id]);

        res.json({ 
            success: true, 
            message: 'User updated successfully',
            user: updatedUser.rows[0]
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update user',
            error: error.message 
        });
    }
});

module.exports = router; 