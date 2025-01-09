-- Drop new tables if they exist
DROP TABLE IF EXISTS store_items CASCADE;
DROP TABLE IF EXISTS outbound_items CASCADE;
DROP TABLE IF EXISTS stores CASCADE;

-- Create stores table
CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create outbound_items table
CREATE TABLE outbound_items (
    id SERIAL PRIMARY KEY,
    record_id INTEGER REFERENCES system_records(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create store_items table
CREATE TABLE IF NOT EXISTS store_items (
    id SERIAL PRIMARY KEY,
    store_id INTEGER REFERENCES stores(id),
    record_id INTEGER REFERENCES system_records(id),
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(record_id)  -- Ensures each record can only be in one store
);

-- Create indexes
CREATE INDEX idx_outbound_items_status ON outbound_items(status);
CREATE INDEX idx_store_items_store_id ON store_items(store_id);
CREATE INDEX idx_store_items_record_id ON store_items(record_id);

-- Insert default stores if they don't exist
INSERT INTO stores (name, address, phone, email, description)
SELECT 'Main Store', '123 Main St', '123-456-7890', 'john@mainstore.com', 'Main store location'
WHERE NOT EXISTS (SELECT 1 FROM stores WHERE name = 'Main Store');

INSERT INTO stores (name, address, phone, email, description)
SELECT 'FMP Store', '456 FMP Ave', '234-567-8901', 'jane@fmpstore.com', 'FMP branch location'
WHERE NOT EXISTS (SELECT 1 FROM stores WHERE name = 'FMP Store');

INSERT INTO stores (name, address, phone, email, description)
SELECT 'Mississauga Store', '789 Mississauga Rd', '345-678-9012', 'bob@mississaugastore.com', 'Mississauga branch location'
WHERE NOT EXISTS (SELECT 1 FROM stores WHERE name = 'Mississauga Store'); 