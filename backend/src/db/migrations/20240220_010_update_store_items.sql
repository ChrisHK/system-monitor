-- 創建更新時間戳的函數
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 檢查表和列是否存在並創建
DO $$
BEGIN
    -- 創建表（如果不存在）
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'store_items'
    ) THEN
        CREATE TABLE store_items (
            id SERIAL PRIMARY KEY,
            store_id INTEGER NOT NULL,
            record_id INTEGER NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'active',
            added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            added_by INTEGER,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_by INTEGER,
            notes TEXT,
            CONSTRAINT fk_store_items_store
                FOREIGN KEY (store_id) 
                REFERENCES stores(id)
                ON DELETE CASCADE,
            CONSTRAINT fk_store_items_record
                FOREIGN KEY (record_id) 
                REFERENCES system_records(id)
                ON DELETE CASCADE,
            CONSTRAINT fk_store_items_added_by
                FOREIGN KEY (added_by) 
                REFERENCES users(id)
                ON DELETE SET NULL,
            CONSTRAINT fk_store_items_updated_by
                FOREIGN KEY (updated_by) 
                REFERENCES users(id)
                ON DELETE SET NULL
        );

        -- 添加表註釋
        COMMENT ON TABLE store_items IS 'Stores items assigned to stores';
    ELSE
        -- 檢查並添加缺失的列
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'store_items' 
            AND column_name = 'added_by'
        ) THEN
            ALTER TABLE store_items 
            ADD COLUMN added_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'store_items' 
            AND column_name = 'added_at'
        ) THEN
            ALTER TABLE store_items 
            ADD COLUMN added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        END IF;

        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'store_items' 
            AND column_name = 'updated_by'
        ) THEN
            ALTER TABLE store_items 
            ADD COLUMN updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'store_items' 
            AND column_name = 'updated_at'
        ) THEN
            ALTER TABLE store_items 
            ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        END IF;

        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'store_items' 
            AND column_name = 'status'
        ) THEN
            ALTER TABLE store_items 
            ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active';
        END IF;

        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'store_items' 
            AND column_name = 'notes'
        ) THEN
            ALTER TABLE store_items 
            ADD COLUMN notes TEXT;
        END IF;
    END IF;
END $$;

-- 創建索引
DO $$
BEGIN
    -- 檢查並創建狀態索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_store_items_status'
    ) THEN
        CREATE INDEX idx_store_items_status ON store_items(status);
    END IF;

    -- 檢查並創建商店索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_store_items_store_id'
    ) THEN
        CREATE INDEX idx_store_items_store_id ON store_items(store_id);
    END IF;

    -- 檢查並創建記錄索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_store_items_record_id'
    ) THEN
        CREATE INDEX idx_store_items_record_id ON store_items(record_id);
    END IF;

    -- 檢查並創建添加時間索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_store_items_added_at'
    ) THEN
        CREATE INDEX idx_store_items_added_at ON store_items(added_at);
    END IF;
END $$;

-- 創建觸發器
DO $$
BEGIN
    -- 檢查並創建觸發器
    IF NOT EXISTS (
        SELECT FROM pg_trigger 
        WHERE tgname = 'tr_store_items_updated_at'
    ) THEN
        DROP TRIGGER IF EXISTS tr_store_items_updated_at ON store_items;
        CREATE TRIGGER tr_store_items_updated_at
        BEFORE UPDATE ON store_items
        FOR EACH ROW
        EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$; 