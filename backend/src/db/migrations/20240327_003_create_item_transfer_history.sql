-- Description: Create item_transfer_history table for tracking item transfers between stores
BEGIN;

-- Create enum type for transfer types if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transfer_type') THEN
        CREATE TYPE transfer_type AS ENUM ('store_transfer', 'rma_transfer', 'sales_transfer');
    END IF;
END $$;

-- Create item_transfer_history table
CREATE TABLE IF NOT EXISTS item_transfer_history (
    id SERIAL PRIMARY KEY,
    serialnumber VARCHAR(255) NOT NULL,
    source_store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
    target_store_id INTEGER REFERENCES stores(id) ON DELETE SET NULL,
    transfer_type transfer_type NOT NULL,
    transferred_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    transferred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_transfer_history_serialnumber ON item_transfer_history(serialnumber);
CREATE INDEX IF NOT EXISTS idx_transfer_history_source_store ON item_transfer_history(source_store_id);
CREATE INDEX IF NOT EXISTS idx_transfer_history_target_store ON item_transfer_history(target_store_id);
CREATE INDEX IF NOT EXISTS idx_transfer_history_transferred_at ON item_transfer_history(transferred_at);

-- Add comments
COMMENT ON TABLE item_transfer_history IS 'Records the history of item transfers between stores';
COMMENT ON COLUMN item_transfer_history.serialnumber IS 'Serial number of the transferred item';
COMMENT ON COLUMN item_transfer_history.source_store_id IS 'ID of the store the item was transferred from';
COMMENT ON COLUMN item_transfer_history.target_store_id IS 'ID of the store the item was transferred to';
COMMENT ON COLUMN item_transfer_history.transfer_type IS 'Type of transfer (store_transfer, rma_transfer, sales_transfer)';
COMMENT ON COLUMN item_transfer_history.transferred_by IS 'ID of the user who performed the transfer';
COMMENT ON COLUMN item_transfer_history.transferred_at IS 'Timestamp when the transfer occurred';
COMMENT ON COLUMN item_transfer_history.notes IS 'Additional notes about the transfer';
COMMENT ON COLUMN item_transfer_history.created_at IS 'Timestamp when the record was created';

COMMIT; 