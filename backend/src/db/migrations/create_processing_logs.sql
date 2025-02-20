-- 開始事務
BEGIN;

-- 創建處理日誌表
CREATE TABLE IF NOT EXISTS processing_logs (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR(100) NOT NULL,
    source VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    total_items INTEGER NOT NULL,
    processed_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]'::jsonb,
    error_message TEXT,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 創建歸檔表
CREATE TABLE IF NOT EXISTS processing_logs_archive (
    id SERIAL PRIMARY KEY,
    original_id INTEGER NOT NULL,
    batch_id VARCHAR(100) NOT NULL,
    source VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    total_items INTEGER NOT NULL,
    processed_count INTEGER,
    error_count INTEGER,
    errors JSONB,
    error_message TEXT,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    created_at TIMESTAMP,
    archived_at TIMESTAMP NOT NULL
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_processing_logs_batch_id ON processing_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_processing_logs_status ON processing_logs(status);
CREATE INDEX IF NOT EXISTS idx_processing_logs_started_at ON processing_logs(started_at);

CREATE INDEX IF NOT EXISTS idx_processing_logs_archive_batch_id ON processing_logs_archive(batch_id);
CREATE INDEX IF NOT EXISTS idx_processing_logs_archive_archived_at ON processing_logs_archive(archived_at);

-- 創建歸檔觸發器函數
CREATE OR REPLACE FUNCTION archive_old_processing_logs() RETURNS trigger AS $$
BEGIN
    INSERT INTO processing_logs_archive (
        original_id, batch_id, source, status,
        total_items, processed_count, error_count,
        errors, error_message, started_at,
        completed_at, created_at, archived_at
    )
    SELECT 
        id, batch_id, source, status,
        total_items, processed_count, error_count,
        errors, error_message, started_at,
        completed_at, created_at, CURRENT_TIMESTAMP
    FROM processing_logs
    WHERE completed_at < NOW() - INTERVAL '30 days';

    DELETE FROM processing_logs
    WHERE completed_at < NOW() - INTERVAL '30 days';

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 創建定時歸檔觸發器
DROP TRIGGER IF EXISTS trigger_archive_old_processing_logs ON processing_logs;
CREATE TRIGGER trigger_archive_old_processing_logs
    AFTER INSERT ON processing_logs
    FOR EACH STATEMENT
    EXECUTE PROCEDURE archive_old_processing_logs();

-- 提交事務
COMMIT;

-- 回滾腳本（如果需要）
/*
BEGIN;
DROP TRIGGER IF EXISTS trigger_archive_old_processing_logs ON processing_logs;
DROP FUNCTION IF EXISTS archive_old_processing_logs();
DROP TABLE IF EXISTS processing_logs_archive;
DROP TABLE IF EXISTS processing_logs;
COMMIT;
*/ 