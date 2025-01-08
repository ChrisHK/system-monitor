-- Drop new tables if they exist
DROP TABLE IF EXISTS store_items CASCADE;
DROP TABLE IF EXISTS outbound_items CASCADE;
DROP TABLE IF EXISTS stores CASCADE;

-- Create stores table
CREATE TABLE stores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    contact_person VARCHAR(255),
    email VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
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
CREATE TABLE store_items (
    id SERIAL PRIMARY KEY,
    store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
    record_id INTEGER REFERENCES system_records(id) ON DELETE CASCADE,
    received_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_outbound_items_status ON outbound_items(status);
CREATE INDEX idx_store_items_store_id ON store_items(store_id);
CREATE INDEX idx_store_items_record_id ON store_items(record_id);

-- Insert default stores if they don't exist
INSERT INTO stores (name, address, phone, contact_person, email)
SELECT 'Main Store', '123 Main St', '123-456-7890', 'John Doe', 'john@mainstore.com'
WHERE NOT EXISTS (SELECT 1 FROM stores WHERE name = 'Main Store');

INSERT INTO stores (name, address, phone, contact_person, email)
SELECT 'FMP Store', '456 FMP Ave', '234-567-8901', 'Jane Smith', 'jane@fmpstore.com'
WHERE NOT EXISTS (SELECT 1 FROM stores WHERE name = 'FMP Store');

INSERT INTO stores (name, address, phone, contact_person, email)
SELECT 'Mississauga Store', '789 Mississauga Rd', '345-678-9012', 'Bob Wilson', 'bob@mississaugastore.com'
WHERE NOT EXISTS (SELECT 1 FROM stores WHERE name = 'Mississauga Store'); 