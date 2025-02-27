-- Description: Add notes column to store_items table
BEGIN;

-- Check if notes column exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'store_items' 
        AND column_name = 'notes'
    ) THEN
        -- Add notes column
        ALTER TABLE store_items
        ADD COLUMN notes TEXT;

        -- Add comment to the column
        COMMENT ON COLUMN store_items.notes IS 'Notes for store items';
    END IF;
END $$;

COMMIT; 