-- 創建同步日誌表
CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    operation VARCHAR(10) NOT NULL,  -- INSERT, UPDATE, DELETE
    old_data JSONB,
    new_data JSONB,
    sync_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    synced_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT valid_operation CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    CONSTRAINT valid_status CHECK (sync_status IN ('pending', 'processing', 'completed', 'failed'))
);

-- 創建同步配置表
CREATE TABLE IF NOT EXISTS sync_config (
    table_name VARCHAR(50) PRIMARY KEY,
    is_enabled BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_interval INTEGER DEFAULT 60, -- 同步間隔（秒）
    batch_size INTEGER DEFAULT 100,   -- 每批同步數量
    max_retries INTEGER DEFAULT 3,    -- 最大重試次數
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 創建同步統計表
CREATE TABLE IF NOT EXISTS sync_stats (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    sync_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_records INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (table_name, sync_date)
);

-- 創建變更記錄觸發器函數
CREATE OR REPLACE FUNCTION log_table_changes()
RETURNS TRIGGER AS $$
DECLARE
    should_sync BOOLEAN;
BEGIN
    -- 檢查表是否啟用同步
    SELECT is_enabled INTO should_sync 
    FROM sync_config 
    WHERE table_name = TG_TABLE_NAME;

    -- 如果未配置或已禁用，則跳過記錄
    IF should_sync IS NULL OR NOT should_sync THEN
        RETURN NULL;
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO sync_log (table_name, record_id, operation, new_data)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
        -- 只有當數據真正變化時才記錄
        IF NEW != OLD THEN
            INSERT INTO sync_log (table_name, record_id, operation, old_data, new_data)
            VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW));
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO sync_log (table_name, record_id, operation, old_data)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD));
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 為 inventory 表添加觸發器
DROP TRIGGER IF EXISTS inventory_changes ON inventory;
CREATE TRIGGER inventory_changes
    AFTER INSERT OR UPDATE OR DELETE ON inventory
    FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- 初始化同步配置
INSERT INTO sync_config (table_name, is_enabled, sync_interval, batch_size, max_retries)
VALUES 
    ('inventory', true, 60, 100, 3)
ON CONFLICT (table_name) 
DO UPDATE SET
    updated_at = CURRENT_TIMESTAMP;

-- 創建更新統計的函數
CREATE OR REPLACE FUNCTION update_sync_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sync_status = 'completed' THEN
        INSERT INTO sync_stats (
            table_name, 
            sync_date, 
            total_records,
            success_count,
            last_sync_at
        )
        VALUES (
            NEW.table_name,
            CURRENT_DATE,
            1,
            1,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (table_name, sync_date)
        DO UPDATE SET
            total_records = sync_stats.total_records + 1,
            success_count = sync_stats.success_count + 1,
            last_sync_at = CURRENT_TIMESTAMP;
    ELSIF NEW.sync_status = 'failed' THEN
        INSERT INTO sync_stats (
            table_name, 
            sync_date, 
            total_records,
            failed_count,
            last_sync_at
        )
        VALUES (
            NEW.table_name,
            CURRENT_DATE,
            1,
            1,
            CURRENT_TIMESTAMP
        )
        ON CONFLICT (table_name, sync_date)
        DO UPDATE SET
            total_records = sync_stats.total_records + 1,
            failed_count = sync_stats.failed_count + 1,
            last_sync_at = CURRENT_TIMESTAMP;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 為 sync_log 表添加統計觸發器
CREATE TRIGGER update_sync_stats_trigger
    AFTER UPDATE OF sync_status ON sync_log
    FOR EACH ROW
    WHEN (OLD.sync_status != NEW.sync_status)
    EXECUTE FUNCTION update_sync_stats(); 