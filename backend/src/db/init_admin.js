const bcrypt = require('bcrypt');
const pool = require('../db');

const createAdminUser = async () => {
    try {
        // Check if admin role exists
        const roleResult = await pool.query(
            'SELECT id FROM roles WHERE name = $1',
            ['admin']
        );

        if (roleResult.rows.length === 0) {
            console.error('Admin role not found');
            process.exit(1);
        }

        const adminRoleId = roleResult.rows[0].id;

        // Check if admin user already exists
        const userResult = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            ['admin']
        );

        if (userResult.rows.length > 0) {
            console.log('Admin user already exists');
            process.exit(0);
        }

        // Create admin user
        const password = 'admin123'; // Default password
        const passwordHash = await bcrypt.hash(password, 10);

        await pool.query(
            'INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3)',
            ['admin', passwordHash, adminRoleId]
        );

        console.log('Admin user created successfully');
        console.log('Username: admin');
        console.log('Password: admin123');
        console.log('Please change the password after first login');

        process.exit(0);
    } catch (error) {
        console.error('Error creating admin user:', error);
        process.exit(1);
    }
};

createAdminUser(); 