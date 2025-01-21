const pool = require('../../db');

async function createSalesAndRmaTables() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Create sales table
        await client.query(`
            CREATE TABLE IF NOT EXISTS store_sales (
                id SERIAL PRIMARY KEY,
                store_id INTEGER NOT NULL REFERENCES stores(id),
                record_id INTEGER NOT NULL REFERENCES system_records(id),
                price DECIMAL(10, 2) NOT NULL,
                sale_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(record_id)
            )
        `);

        // Create RMA table
        await client.query(`
            CREATE TABLE IF NOT EXISTS store_rma (
                id SERIAL PRIMARY KEY,
                store_id INTEGER NOT NULL REFERENCES stores(id),
                record_id INTEGER NOT NULL REFERENCES system_records(id),
                rma_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                reason TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(record_id)
            )
        `);

        // Create indexes
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_store_sales_store_id ON store_sales(store_id);
            CREATE INDEX IF NOT EXISTS idx_store_sales_record_id ON store_sales(record_id);
            CREATE INDEX IF NOT EXISTS idx_store_rma_store_id ON store_rma(store_id);
            CREATE INDEX IF NOT EXISTS idx_store_rma_record_id ON store_rma(record_id);
        `);

        await client.query('COMMIT');
        console.log('Successfully created sales and RMA tables');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating sales and RMA tables:', error);
        throw error;
    } finally {
        client.release();
    }
}

createSalesAndRmaTables(); 