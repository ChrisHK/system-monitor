const pool = require('../../db');

async function createOrdersTable() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Create orders table
        await client.query(`
            CREATE TABLE IF NOT EXISTS store_orders (
                id SERIAL PRIMARY KEY,
                store_id INTEGER NOT NULL REFERENCES stores(id),
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create order items table
        await client.query(`
            CREATE TABLE IF NOT EXISTS store_order_items (
                id SERIAL PRIMARY KEY,
                order_id INTEGER NOT NULL REFERENCES store_orders(id),
                record_id INTEGER NOT NULL REFERENCES system_records(id),
                price DECIMAL(10, 2),
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(record_id)
            )
        `);

        // Create indexes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_store_orders_store_id ON store_orders(store_id);
            CREATE INDEX IF NOT EXISTS idx_store_order_items_order_id ON store_order_items(order_id);
            CREATE INDEX IF NOT EXISTS idx_store_order_items_record_id ON store_order_items(record_id);
        `);

        await client.query('COMMIT');
        console.log('Successfully created orders tables');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating orders tables:', error);
        throw error;
    } finally {
        client.release();
    }
}

createOrdersTable(); 