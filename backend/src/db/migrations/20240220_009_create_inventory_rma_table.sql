-- 開始事務
BEGIN;

-- 創建 inventory_rma 表
CREATE TABLE IF NOT EXISTS inventory_rma (
    id SERIAL PRIMARY KEY,
    store_rma_id INTEGER REFERENCES store_rma(id),
    store_id INTEGER REFERENCES stores(id),
    record_id INTEGER REFERENCES system_records(id),
    serialnumber VARCHAR(100) NOT NULL,
    model VARCHAR(200),
    manufacturer VARCHAR(200),
    issue_description TEXT,
    diagnosis TEXT,
    solution TEXT,
    failed_reason TEXT,
    status rma_inventory_status NOT NULL DEFAULT 'receive',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    created_by INTEGER REFERENCES users(id),
    processed_by INTEGER REFERENCES users(id),
    completed_by INTEGER REFERENCES users(id),
    failed_by INTEGER REFERENCES users(id),
    store_name VARCHAR(200)
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_inventory_rma_store_rma_id ON inventory_rma(store_rma_id);
CREATE INDEX IF NOT EXISTS idx_inventory_rma_store_id ON inventory_rma(store_id);
CREATE INDEX IF NOT EXISTS idx_inventory_rma_record_id ON inventory_rma(record_id);
CREATE INDEX IF NOT EXISTS idx_inventory_rma_serialnumber ON inventory_rma(serialnumber);
CREATE INDEX IF NOT EXISTS idx_inventory_rma_status ON inventory_rma(status);
CREATE INDEX IF NOT EXISTS idx_inventory_rma_created_at ON inventory_rma(created_at DESC);

-- 添加觸發器函數來更新關聯的 store_rma
CREATE OR REPLACE FUNCTION sync_inventory_rma_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        UPDATE store_rma
        SET inventory_status = NEW.status::rma_inventory_status
        WHERE id = NEW.store_rma_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器
DROP TRIGGER IF EXISTS trigger_sync_inventory_rma_status ON inventory_rma;
CREATE TRIGGER trigger_sync_inventory_rma_status
    AFTER UPDATE OF status ON inventory_rma
    FOR EACH ROW
    EXECUTE PROCEDURE sync_inventory_rma_status();

-- 添加註釋
COMMENT ON TABLE inventory_rma IS 'Inventory RMA 記錄表';
COMMENT ON COLUMN inventory_rma.store_rma_id IS '關聯的 store_rma ID';
COMMENT ON COLUMN inventory_rma.status IS 'RMA 狀態：receive（接收）, process（處理中）, complete（完成）, failed（失敗）';

-- 提交事務
COMMIT;

-- 驗證表結構
SELECT 
    table_name,
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'inventory_rma'
ORDER BY ordinal_position;

-- 回滾腳本
/*
BEGIN;
DROP TRIGGER IF EXISTS trigger_sync_inventory_rma_status ON inventory_rma;
DROP FUNCTION IF EXISTS sync_inventory_rma_status();
DROP TABLE IF EXISTS inventory_rma;
COMMIT;
*/ 