const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const createTables = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Create store_orders table
        await client.query(`
            CREATE TABLE IF NOT EXISTS store_orders (
                id SERIAL PRIMARY KEY,
                store_id INTEGER NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (store_id) REFERENCES stores(id)
            )
        `);

        // Create store_order_items table
        await client.query(`
            CREATE TABLE IF NOT EXISTS store_order_items (
                id SERIAL PRIMARY KEY,
                order_id INTEGER NOT NULL,
                record_id INTEGER NOT NULL,
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                price DECIMAL(10, 2),
                FOREIGN KEY (order_id) REFERENCES store_orders(id),
                FOREIGN KEY (record_id) REFERENCES system_records(id)
            )
        `);

        // Create store_rma table
        await client.query(`
            CREATE TABLE IF NOT EXISTS store_rma (
                id SERIAL PRIMARY KEY,
                store_id INTEGER NOT NULL,
                record_id INTEGER NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                reason TEXT,
                notes TEXT,
                rma_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (store_id) REFERENCES stores(id),
                FOREIGN KEY (record_id) REFERENCES system_records(id)
            )
        `);

        // Create indexes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_store_orders_store_id ON store_orders(store_id);
            CREATE INDEX IF NOT EXISTS idx_store_order_items_order_id ON store_order_items(order_id);
            CREATE INDEX IF NOT EXISTS idx_store_order_items_record_id ON store_order_items(record_id);
            CREATE INDEX IF NOT EXISTS idx_store_rma_store_id ON store_rma(store_id);
            CREATE INDEX IF NOT EXISTS idx_store_rma_record_id ON store_rma(record_id);
        `);

        await client.query('COMMIT');
        console.log('Tables created successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating tables:', error);
        throw error;
    } finally {
        client.release();
    }
};

// Call the function to create tables
createTables().catch(console.error);

module.exports = pool; 