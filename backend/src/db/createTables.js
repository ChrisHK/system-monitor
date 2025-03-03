const db = require('../db');
const fs = require('fs').promises;
const path = require('path');

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
        const updateRmaTables = require('../migrations/update_rma_tables');
        await updateRmaTables(db);

        // Run new migration for inventory_rma table
        const inventoryRmaMigration = await fs.readFile(
            path.join(__dirname, 'migrations', '20240220_009_create_inventory_rma_table.sql'),
            'utf8'
        );
        await client.query(inventoryRmaMigration);

        // Run migration to add diagnosis to store_rma
        const addDiagnosisMigration = await fs.readFile(
            path.join(__dirname, 'migrations', '20240221_010_add_diagnosis_to_store_rma.sql'),
            'utf8'
        );
        await client.query(addDiagnosisMigration);

        // Run migration to add solution to store_rma
        const addSolutionMigration = await fs.readFile(
            path.join(__dirname, 'migrations', '20240221_011_add_solution_to_store_rma.sql'),
            'utf8'
        );
        await client.query(addSolutionMigration);

        // Run migration to add system records indexes
        const addSystemRecordsIndexes = await fs.readFile(
            path.join(__dirname, 'migrations', '20240222_012_add_system_records_indexes.sql'),
            'utf8'
        );
        await client.query(addSystemRecordsIndexes);

        // Run migration to create processing_logs table
        const createProcessingLogsTable = await fs.readFile(
            path.join(__dirname, 'migrations', '20240222_013_create_processing_logs_table.sql'),
            'utf8'
        );
        await client.query(createProcessingLogsTable);

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