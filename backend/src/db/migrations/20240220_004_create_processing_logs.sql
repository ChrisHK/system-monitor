-- 開始事務
BEGIN;

-- 創建 processing_logs 表
CREATE TABLE IF NOT EXISTS processing_logs (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR(100) NOT NULL,
    source VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    errors JSONB DEFAULT '[]'::jsonb,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 創建 processing_logs_archive 表
CREATE TABLE IF NOT EXISTS processing_logs_archive (
    id SERIAL PRIMARY KEY,
    original_id INTEGER,
    batch_id VARCHAR(100) NOT NULL,
    source VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    total_items INTEGER NOT NULL,
    processed_count INTEGER NOT NULL,
    error_count INTEGER NOT NULL,
    errors JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_processing_logs_batch_id ON processing_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_processing_logs_status ON processing_logs(status);
CREATE INDEX IF NOT EXISTS idx_processing_logs_source ON processing_logs(source);
CREATE INDEX IF NOT EXISTS idx_processing_logs_started_at ON processing_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_processing_logs_completed_at ON processing_logs(completed_at);

CREATE INDEX IF NOT EXISTS idx_processing_logs_archive_batch_id ON processing_logs_archive(batch_id);
CREATE INDEX IF NOT EXISTS idx_processing_logs_archive_status ON processing_logs_archive(status);
CREATE INDEX IF NOT EXISTS idx_processing_logs_archive_source ON processing_logs_archive(source);
CREATE INDEX IF NOT EXISTS idx_processing_logs_archive_archived_at ON processing_logs_archive(archived_at);

-- 添加註釋
COMMENT ON TABLE processing_logs IS '處理日誌表';
COMMENT ON TABLE processing_logs_archive IS '處理日誌歸檔表';

-- 提交事務
COMMIT;

-- 驗證
SELECT 
    table_name,
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('processing_logs', 'processing_logs_archive')
ORDER BY table_name, ordinal_position;

-- 回滾腳本
/*
BEGIN;
DROP TABLE IF EXISTS processing_logs_archive;
DROP TABLE IF EXISTS processing_logs;
COMMIT;
*/ 