-- Create outbound table
CREATE TABLE IF NOT EXISTS outbound (
    id SERIAL PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Create outbound_items table
CREATE TABLE IF NOT EXISTS outbound_items (
    id SERIAL PRIMARY KEY,
    outbound_id INTEGER REFERENCES outbound(id) ON DELETE CASCADE,
    record_id INTEGER REFERENCES system_records(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(outbound_id, record_id)
); 