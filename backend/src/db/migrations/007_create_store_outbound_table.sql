CREATE TABLE IF NOT EXISTS store_outbound (
    id SERIAL PRIMARY KEY,
    store_id INTEGER NOT NULL REFERENCES stores(id),
    record_id INTEGER NOT NULL REFERENCES records(id),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(record_id)  -- Ensures each record can only be assigned to one store
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_store_outbound_store_id ON store_outbound(store_id);
CREATE INDEX IF NOT EXISTS idx_store_outbound_record_id ON store_outbound(record_id);
CREATE INDEX IF NOT EXISTS idx_store_outbound_status ON store_outbound(status); 