-- Add is_deleted column to store_order_items
ALTER TABLE store_order_items ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Drop the existing unique constraint
ALTER TABLE store_order_items DROP CONSTRAINT IF EXISTS store_order_items_record_id_key;

-- Create a new unique constraint that includes is_deleted
CREATE UNIQUE INDEX store_order_items_record_id_active_idx ON store_order_items (record_id) WHERE NOT is_deleted;

-- Update existing records
UPDATE store_order_items SET is_deleted = false WHERE is_deleted IS NULL; 