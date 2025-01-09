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
            role: req.user.role_name
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
        const result = await pool.query(
            'SELECT users.id, users.username, users.is_active, users.last_login, roles.name as role FROM users JOIN roles ON users.role_id = roles.id ORDER BY users.created_at DESC'
        );

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
        const { username, password, role, is_active } = req.body;

        let updates = [];
        let values = [];
        let paramCount = 1;

        if (username) {
            updates.push(`username = $${paramCount}`);
            values.push(username);
            paramCount++;
        }

        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            updates.push(`password_hash = $${paramCount}`);
            values.push(passwordHash);
            paramCount++;
        }

        if (role) {
            const roleResult = await pool.query(
                'SELECT id FROM roles WHERE name = $1',
                [role]
            );
            if (roleResult.rows.length > 0) {
                updates.push(`role_id = $${paramCount}`);
                values.push(roleResult.rows[0].id);
                paramCount++;
            }
        }

        if (typeof is_active === 'boolean') {
            updates.push(`is_active = $${paramCount}`);
            values.push(is_active);
            paramCount++;
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No updates provided'
            });
        }

        values.push(id);
        const query = `
            UPDATE users 
            SET ${updates.join(', ')} 
            WHERE id = $${paramCount}
            RETURNING id
        `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User updated successfully'
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            error: 'Error updating user'
        });
    }
});

module.exports = router; 