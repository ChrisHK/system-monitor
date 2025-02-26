-- 檢查表和列是否存在並創建
DO $$
BEGIN
    -- 創建表（如果不存在）
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'outbound_items'
    ) THEN
        CREATE TABLE outbound_items (
            id SERIAL PRIMARY KEY,
            outbound_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 0,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            completed_at TIMESTAMP WITH TIME ZONE,
            completed_by INTEGER
        );

        -- 添加表註釋
        COMMENT ON TABLE outbound_items IS 'Stores outbound items with their status and tracking information';
    ELSE
        -- 檢查並添加缺失的列
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'outbound_items' 
            AND column_name = 'completed_at'
        ) THEN
            ALTER TABLE outbound_items 
            ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
        END IF;

        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'outbound_items' 
            AND column_name = 'completed_by'
        ) THEN
            ALTER TABLE outbound_items 
            ADD COLUMN completed_by INTEGER;
        END IF;

        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'outbound_items' 
            AND column_name = 'created_at'
        ) THEN
            ALTER TABLE outbound_items 
            ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        END IF;

        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'outbound_items' 
            AND column_name = 'created_by'
        ) THEN
            ALTER TABLE outbound_items 
            ADD COLUMN created_by INTEGER;
        END IF;
    END IF;
END $$;

-- 檢查並創建索引
DO $$
BEGIN
    -- 檢查並創建狀態索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_outbound_items_status'
    ) THEN
        CREATE INDEX idx_outbound_items_status ON outbound_items(status);
    END IF;

    -- 檢查並創建完成時間索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_outbound_items_completed_at'
    ) THEN
        CREATE INDEX idx_outbound_items_completed_at ON outbound_items(completed_at);
    END IF;

    -- 檢查並創建創建時間索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_outbound_items_created_at'
    ) THEN
        CREATE INDEX idx_outbound_items_created_at ON outbound_items(created_at);
    END IF;
END $$;

-- 檢查並添加外鍵約束
DO $$
BEGIN
    -- 檢查並添加 created_by 外鍵
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_outbound_items_created_by'
    ) THEN
        ALTER TABLE outbound_items
        ADD CONSTRAINT fk_outbound_items_created_by 
        FOREIGN KEY (created_by) REFERENCES users(id)
        ON DELETE SET NULL;
    END IF;

    -- 檢查並添加 completed_by 外鍵
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_outbound_items_completed_by'
    ) THEN
        ALTER TABLE outbound_items
        ADD CONSTRAINT fk_outbound_items_completed_by 
        FOREIGN KEY (completed_by) REFERENCES users(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 驗證查詢
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'outbound_items'
ORDER BY ordinal_position; 