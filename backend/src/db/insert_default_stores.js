const pool = require('../db');

async function insertDefaultStores() {
    try {
        console.log('Inserting default stores...');
        
        const defaultStores = [
            {
                name: 'Main Store',
                address: '123 Main St',
                phone: '123-456-7890',
                email: 'john@mainstore.com',
                description: 'Main store location'
            },
            {
                name: 'FMP Store',
                address: '456 FMP Ave',
                phone: '234-567-8901',
                email: 'jane@fmpstore.com',
                description: 'FMP branch location'
            },
            {
                name: 'Mississauga Store',
                address: '789 Mississauga Rd',
                phone: '345-678-9012',
                email: 'bob@mississaugastore.com',
                description: 'Mississauga branch location'
            }
        ];

        // Start transaction
        await pool.query('BEGIN');

        // First, clear related tables
        await pool.query('DELETE FROM store_items');
        await pool.query('DELETE FROM stores');

        // Insert new stores
        for (const store of defaultStores) {
            await pool.query(
                'INSERT INTO stores (name, address, phone, email, description) VALUES ($1, $2, $3, $4, $5)',
                [store.name, store.address, store.phone, store.email, store.description]
            );
        }

        // Commit transaction
        await pool.query('COMMIT');

        console.log('Default stores inserted successfully');
        
        // Verify the insertion
        const result = await pool.query('SELECT * FROM stores ORDER BY name');
        console.log('Current stores:', result.rows);
        
        process.exit(0);
    } catch (error) {
        // Rollback on error
        await pool.query('ROLLBACK');
        console.error('Error inserting default stores:', error);
        process.exit(1);
    }
}

insertDefaultStores(); 