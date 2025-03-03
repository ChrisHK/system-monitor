-- Description: Add soft delete columns to store_items table
BEGIN;

-- Add soft delete columns to store_items table
ALTER TABLE store_items
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN deleted_by INTEGER REFERENCES users(id);

-- Add index for deleted_at for better query performance
CREATE INDEX idx_store_items_deleted_at ON store_items(deleted_at);

-- Add comment
COMMENT ON COLUMN store_items.deleted_at IS 'Timestamp when the item was soft deleted';
COMMENT ON COLUMN store_items.deleted_by IS 'User ID who performed the soft delete';

COMMIT; 