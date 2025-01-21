require('dotenv').config();
const pool = require('../../db');

async function updateRmaTables() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('Starting RMA tables update...');

        // 1. 備份現有數據
        console.log('Backing up existing RMA data...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS store_rma_backup AS 
            SELECT * FROM store_rma;
        `);

        // 2. 創建新的狀態枚舉類型
        console.log('Creating status enums...');
        await client.query(`
            -- Drop existing types if they exist
            DROP TYPE IF EXISTS rma_store_status CASCADE;
            DROP TYPE IF EXISTS rma_inventory_status CASCADE;

            -- Create new types
            CREATE TYPE rma_store_status AS ENUM (
                'pending',
                'sent_to_inventory',
                'completed',
                'failed',
                'sent_to_store'
            );

            CREATE TYPE rma_inventory_status AS ENUM (
                'receive',
                'process',
                'complete',
                'failed'
            );
        `);

        // 3. 修改 store_rma 表結構
        console.log('Modifying store_rma table structure...');
        await client.query(`
            -- 添加新的欄位
            ALTER TABLE store_rma 
            ADD COLUMN IF NOT EXISTS location_type VARCHAR(50) DEFAULT 'store',
            ADD COLUMN IF NOT EXISTS inventory_status rma_inventory_status DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS store_status rma_store_status DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP WITH TIME ZONE,
            ADD COLUMN IF NOT EXISTS failed_reason TEXT,
            ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        `);

        // 4. 創建更新觸發器
        console.log('Creating update trigger...');
        await client.query(`
            CREATE OR REPLACE FUNCTION update_rma_last_updated()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.last_updated = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';

            DROP TRIGGER IF EXISTS update_rma_last_updated_trigger ON store_rma;
            
            CREATE TRIGGER update_rma_last_updated_trigger
                BEFORE UPDATE ON store_rma
                FOR EACH ROW
                EXECUTE FUNCTION update_rma_last_updated();
        `);

        // 5. 創建索引
        console.log('Creating indexes...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_store_rma_location_type ON store_rma(location_type);
            CREATE INDEX IF NOT EXISTS idx_store_rma_inventory_status ON store_rma(inventory_status);
            CREATE INDEX IF NOT EXISTS idx_store_rma_store_status ON store_rma(store_status);
            CREATE INDEX IF NOT EXISTS idx_store_rma_last_updated ON store_rma(last_updated);
            CREATE INDEX IF NOT EXISTS idx_store_rma_store_id ON store_rma(store_id);
            CREATE INDEX IF NOT EXISTS idx_store_rma_record_id ON store_rma(record_id);
        `);

        // 6. 更新現有數據
        console.log('Updating existing records...');
        await client.query(`
            UPDATE store_rma 
            SET 
                location_type = 'store',
                store_status = 'pending'::rma_store_status,
                last_updated = CURRENT_TIMESTAMP
            WHERE location_type IS NULL;
        `);

        // 7. 添加外鍵約束
        console.log('Adding foreign key constraints...');
        await client.query(`
            DO $$ BEGIN
                ALTER TABLE store_rma
                ADD CONSTRAINT fk_store_rma_store
                FOREIGN KEY (store_id)
                REFERENCES stores(id);
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;

            DO $$ BEGIN
                ALTER TABLE store_rma
                ADD CONSTRAINT fk_store_rma_record
                FOREIGN KEY (record_id)
                REFERENCES system_records(id);
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        await client.query('COMMIT');
        console.log('Successfully updated RMA tables');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating RMA tables:', error);
        throw error;
    } finally {
        client.release();
    }
}

// 執行更新
if (require.main === module) {
    updateRmaTables()
        .then(() => {
            console.log('RMA tables update completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('Failed to update RMA tables:', error);
            process.exit(1);
        });
}

module.exports = { updateRmaTables }; 