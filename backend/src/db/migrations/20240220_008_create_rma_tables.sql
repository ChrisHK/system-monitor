-- 開始事務
BEGIN;

-- 創建 RMA 狀態枚舉類型
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rma_status') THEN
        CREATE TYPE rma_status AS ENUM ('receive', 'process', 'complete', 'failed');
    END IF;
END $$;

-- 創建 RMA 記錄表
CREATE TABLE IF NOT EXISTS rma_records (
    id SERIAL PRIMARY KEY,
    serialnumber VARCHAR(100) NOT NULL,
    issue_description TEXT,
    diagnosis TEXT,
    solution TEXT,
    notes TEXT,
    status rma_status NOT NULL DEFAULT 'receive',
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    processed_by INTEGER REFERENCES users(id),
    completed_by INTEGER REFERENCES users(id),
    store_id INTEGER REFERENCES stores(id),
    cost NUMERIC DEFAULT 0,
    parts_used JSONB DEFAULT '[]'::jsonb,
    is_warranty BOOLEAN DEFAULT false,
    warranty_info JSONB DEFAULT '{}'::jsonb
);

-- 創建 RMA 歷史記錄表
CREATE TABLE IF NOT EXISTS rma_history (
    id SERIAL PRIMARY KEY,
    rma_id INTEGER REFERENCES rma_records(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    old_status rma_status,
    new_status rma_status,
    changed_fields JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- 創建觸發器函數來更新 updated_at
CREATE OR REPLACE FUNCTION update_rma_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建觸發器
DROP TRIGGER IF EXISTS trigger_update_rma_updated_at ON rma_records;
CREATE TRIGGER trigger_update_rma_updated_at
    BEFORE UPDATE ON rma_records
    FOR EACH ROW
    EXECUTE PROCEDURE update_rma_updated_at();

-- 創建觸發器函數來記錄歷史
CREATE OR REPLACE FUNCTION log_rma_changes()
RETURNS TRIGGER AS $$
DECLARE
    changed jsonb;
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        -- 構建變更字段
        changed := jsonb_build_object(
            'status', CASE WHEN OLD.status IS DISTINCT FROM NEW.status 
                THEN jsonb_build_object('old', OLD.status, 'new', NEW.status)
                ELSE NULL END,
            'issue_description', CASE WHEN OLD.issue_description IS DISTINCT FROM NEW.issue_description 
                THEN jsonb_build_object('old', OLD.issue_description, 'new', NEW.issue_description)
                ELSE NULL END,
            'diagnosis', CASE WHEN OLD.diagnosis IS DISTINCT FROM NEW.diagnosis 
                THEN jsonb_build_object('old', OLD.diagnosis, 'new', NEW.diagnosis)
                ELSE NULL END,
            'solution', CASE WHEN OLD.solution IS DISTINCT FROM NEW.solution 
                THEN jsonb_build_object('old', OLD.solution, 'new', NEW.solution)
                ELSE NULL END,
            'notes', CASE WHEN OLD.notes IS DISTINCT FROM NEW.notes 
                THEN jsonb_build_object('old', OLD.notes, 'new', NEW.notes)
                ELSE NULL END
        );

        -- 插入歷史記錄
        INSERT INTO rma_history (
            rma_id,
            action,
            old_status,
            new_status,
            changed_fields,
            created_by
        ) VALUES (
            NEW.id,
            'UPDATE',
            OLD.status,
            NEW.status,
            changed,
            NEW.processed_by
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 創建歷史記錄觸發器
DROP TRIGGER IF EXISTS trigger_log_rma_changes ON rma_records;
CREATE TRIGGER trigger_log_rma_changes
    AFTER UPDATE ON rma_records
    FOR EACH ROW
    EXECUTE PROCEDURE log_rma_changes();

-- 添加註釋
COMMENT ON TABLE rma_records IS 'RMA 記錄表';
COMMENT ON TABLE rma_history IS 'RMA 歷史記錄表';
COMMENT ON COLUMN rma_records.status IS 'RMA 狀態：receive（接收）, process（處理中）, complete（完成）, failed（失敗）';
COMMENT ON COLUMN rma_records.parts_used IS '使用的零件列表，JSON 格式';
COMMENT ON COLUMN rma_records.warranty_info IS '保修信息，JSON 格式';

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
WHERE table_name IN ('rma_records', 'rma_history')
ORDER BY table_name, ordinal_position;

-- 回滾腳本
/*
BEGIN;
DROP TRIGGER IF EXISTS trigger_log_rma_changes ON rma_records;
DROP TRIGGER IF EXISTS trigger_update_rma_updated_at ON rma_records;
DROP FUNCTION IF EXISTS log_rma_changes();
DROP FUNCTION IF EXISTS update_rma_updated_at();
DROP TABLE IF EXISTS rma_history;
DROP TABLE IF EXISTS rma_records;
DROP TYPE IF EXISTS rma_status;
COMMIT;
*/