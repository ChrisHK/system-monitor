CREATE TABLE IF NOT EXISTS user_store_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, store_id)
);

CREATE INDEX idx_user_store_permissions_user_id ON user_store_permissions(user_id);
CREATE INDEX idx_user_store_permissions_store_id ON user_store_permissions(store_id); 