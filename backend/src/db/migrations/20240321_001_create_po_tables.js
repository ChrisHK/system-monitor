exports.up = async function(knex) {
    // 使用原始 SQL 來創建表
    await knex.raw(`
        -- 先刪除舊的表（如果存在）
        DROP TABLE IF EXISTS purchase_order_items CASCADE;
        DROP TABLE IF EXISTS purchase_orders CASCADE;

        -- 創建 PO 主表
        CREATE TABLE purchase_orders (
            id SERIAL PRIMARY KEY,
            po_number VARCHAR(50) UNIQUE NOT NULL,
            category_id INTEGER REFERENCES tag_categories(id),
            supplier VARCHAR(100) NOT NULL,
            order_date DATE NOT NULL,
            status VARCHAR(20) DEFAULT 'draft',
            total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
            notes TEXT,
            created_by INTEGER REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT true
        );

        -- 創建 PO 明細表
        CREATE TABLE purchase_order_items (
            id SERIAL PRIMARY KEY,
            po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
            serial_number VARCHAR(200) NOT NULL,
            cost DECIMAL(15,2) NOT NULL,
            so VARCHAR(100),
            note TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT true
        );

        -- 創建更新時間戳的觸發器
        CREATE OR REPLACE FUNCTION update_po_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';

        DROP TRIGGER IF EXISTS update_po_updated_at_trigger ON purchase_orders;
        CREATE TRIGGER update_po_updated_at_trigger
            BEFORE UPDATE ON purchase_orders
            FOR EACH ROW
            EXECUTE FUNCTION update_po_updated_at();

        DROP TRIGGER IF EXISTS update_po_items_updated_at_trigger ON purchase_order_items;
        CREATE TRIGGER update_po_items_updated_at_trigger
            BEFORE UPDATE ON purchase_order_items
            FOR EACH ROW
            EXECUTE FUNCTION update_po_updated_at();

        -- 創建索引
        CREATE INDEX IF NOT EXISTS idx_po_category ON purchase_orders(category_id);
        CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier);
        CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
        CREATE INDEX IF NOT EXISTS idx_po_date ON purchase_orders(order_date);
        CREATE INDEX IF NOT EXISTS idx_po_items_po_id ON purchase_order_items(po_id);
    `);
};

exports.down = async function(knex) {
    // 使用原始 SQL 來刪除表
    await knex.raw(`
        -- 刪除索引
        DROP INDEX IF EXISTS idx_po_category;
        DROP INDEX IF EXISTS idx_po_supplier;
        DROP INDEX IF EXISTS idx_po_status;
        DROP INDEX IF EXISTS idx_po_date;
        DROP INDEX IF EXISTS idx_po_items_po_id;

        -- 刪除觸發器和函數
        DROP TRIGGER IF EXISTS update_po_items_updated_at_trigger ON purchase_order_items;
        DROP TRIGGER IF EXISTS update_po_updated_at_trigger ON purchase_orders;
        DROP FUNCTION IF EXISTS update_po_updated_at();

        -- 刪除表
        DROP TABLE IF EXISTS purchase_order_items CASCADE;
        DROP TABLE IF EXISTS purchase_orders CASCADE;
    `);
}; 