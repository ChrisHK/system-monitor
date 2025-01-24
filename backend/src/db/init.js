const db = require('../db');
const bcrypt = require('bcrypt');

const initDatabase = async () => {
    const client = await db.connect();
    try {
        await client.query('BEGIN');

        // Create roles table
        await client.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL
            )
        `);

        // Create users table
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role_id INTEGER REFERENCES roles(id),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                last_login TIMESTAMP WITH TIME ZONE
            )
        `);

        // Insert default roles if they don't exist
        await client.query(`
            INSERT INTO roles (name) 
            VALUES ('admin'), ('user')
            ON CONFLICT (name) DO NOTHING
        `);

        // Get admin role id
        const roleResult = await client.query(
            'SELECT id FROM roles WHERE name = $1',
            ['admin']
        );

        // Check if admin user exists
        const userResult = await client.query(
            'SELECT id FROM users WHERE username = $1',
            ['admin']
        );

        // Create admin user if it doesn't exist
        if (userResult.rows.length === 0) {
            const password = 'admin123';
            const passwordHash = await bcrypt.hash(password, 10);

            await client.query(
                'INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3)',
                ['admin', passwordHash, roleResult.rows[0].id]
            );

            console.log('Admin user created successfully');
            console.log('Username: admin');
            console.log('Password: admin123');
            console.log('Please change the password after first login');
        } else {
            console.log('Admin user already exists');
        }

        await client.query('COMMIT');
        console.log('Database initialization completed successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error initializing database:', error);
        throw error;
    } finally {
        client.release();
    }
};

// Run initialization
initDatabase().catch(console.error); 