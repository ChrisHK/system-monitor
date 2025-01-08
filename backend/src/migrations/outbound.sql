-- Add outbound_status to system_records
ALTER TABLE system_records 
ADD COLUMN IF NOT EXISTS outbound_status VARCHAR(20) DEFAULT 'available',
ADD COLUMN IF NOT EXISTS outbound_id UUID;

-- Create outbound_records table
CREATE TABLE IF NOT EXISTS outbound_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT
);

-- Create outbound_items table for the relationship
CREATE TABLE IF NOT EXISTS outbound_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbound_id UUID REFERENCES outbound_records(id) ON DELETE CASCADE,
    record_id INTEGER REFERENCES system_records(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(outbound_id, record_id)
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_system_records_outbound ON system_records(outbound_status, outbound_id);
CREATE INDEX IF NOT EXISTS idx_outbound_items_outbound_id ON outbound_items(outbound_id);
CREATE INDEX IF NOT EXISTS idx_outbound_items_record_id ON outbound_items(record_id); 