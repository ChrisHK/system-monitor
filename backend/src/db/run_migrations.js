const fs = require('fs');
const path = require('path');
const pool = require('../db');

const runMigrations = async () => {
    try {
        const sql = fs.readFileSync(
            path.join(__dirname, 'migrations', 'create_users_tables.sql'),
            'utf8'
        );

        await pool.query(sql);
        console.log('Migrations completed successfully');

        // Create admin user
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

        if (userResult.rows.length === 0) {
            const bcrypt = require('bcrypt');
            const password = 'admin123';
            const passwordHash = await bcrypt.hash(password, 10);

            await pool.query(
                'INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3)',
                ['admin', passwordHash, adminRoleId]
            );

            console.log('Admin user created successfully');
            console.log('Username: admin');
            console.log('Password: admin123');
            console.log('Please change the password after first login');
        } else {
            console.log('Admin user already exists');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error running migrations:', error);
        process.exit(1);
    }
};

runMigrations(); 