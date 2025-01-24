const db = require('../db');

const createTables = async () => {
    const client = await db.connect();
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

        // Import and run RMA tables update
        const updateRmaTables = require('./migrations/update_rma_tables');
        await updateRmaTables(db);

        await client.query('COMMIT');
        console.log('All tables created and updated successfully');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating/updating tables:', error);
        throw error;
    } finally {
        client.release();
    }
};

module.exports = createTables; 