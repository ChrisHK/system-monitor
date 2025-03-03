-- 開始事務
BEGIN;

-- 創建 processing_logs 表
CREATE TABLE IF NOT EXISTS processing_logs (
    id SERIAL PRIMARY KEY,
    batch_id VARCHAR(100) NOT NULL,
    source VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'processing',
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    errors JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_processing_logs_batch_id ON processing_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_processing_logs_status ON processing_logs(status);
CREATE INDEX IF NOT EXISTS idx_processing_logs_started_at ON processing_logs(started_at DESC);

-- 添加註釋
COMMENT ON TABLE processing_logs IS '數據處理日誌表';
COMMENT ON COLUMN processing_logs.batch_id IS '批次ID';
COMMENT ON COLUMN processing_logs.source IS '數據來源';
COMMENT ON COLUMN processing_logs.status IS '處理狀態';
COMMENT ON COLUMN processing_logs.total_items IS '總項目數';
COMMENT ON COLUMN processing_logs.processed_count IS '已處理數量';
COMMENT ON COLUMN processing_logs.error_count IS '錯誤數量';
COMMENT ON COLUMN processing_logs.started_at IS '開始時間';
COMMENT ON COLUMN processing_logs.completed_at IS '完成時間';
COMMENT ON COLUMN processing_logs.error_message IS '錯誤信息';
COMMENT ON COLUMN processing_logs.errors IS '詳細錯誤列表';

-- 提交事務
COMMIT;

-- 回滾腳本
/*
BEGIN;
DROP TABLE IF EXISTS processing_logs;
COMMIT;
*/ 