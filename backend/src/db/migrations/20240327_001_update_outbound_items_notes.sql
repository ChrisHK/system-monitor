-- Description: Add notes column to outbound_items table
BEGIN;

-- Check if notes column exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'outbound_items' 
        AND column_name = 'notes'
    ) THEN
        -- Add notes column
        ALTER TABLE outbound_items
        ADD COLUMN notes TEXT;

        -- Add comment to the column
        COMMENT ON COLUMN outbound_items.notes IS 'Notes for outbound items';
    END IF;
END $$;

COMMIT; 