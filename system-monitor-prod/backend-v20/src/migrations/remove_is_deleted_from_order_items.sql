-- Drop the unique index
DROP INDEX IF EXISTS store_order_items_record_id_active_idx;

-- Drop the is_deleted column
ALTER TABLE store_order_items DROP COLUMN IF EXISTS is_deleted;

-- Create a new unique constraint for record_id
ALTER TABLE store_order_items ADD CONSTRAINT store_order_items_record_id_key UNIQUE (record_id); 