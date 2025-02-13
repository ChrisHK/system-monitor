-- 創建分類表
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 創建標籤表
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 創建索引
CREATE INDEX idx_categories_name ON categories(name) WHERE is_active = true;
CREATE INDEX idx_tags_name ON tags(name) WHERE is_active = true;
CREATE INDEX idx_tags_category_id ON tags(category_id) WHERE is_active = true;

-- 添加唯一約束
ALTER TABLE categories ADD CONSTRAINT unique_active_category_name 
    UNIQUE (name) WHERE is_active = true;
    
ALTER TABLE tags ADD CONSTRAINT unique_active_tag_name_per_category 
    UNIQUE (name, category_id) WHERE is_active = true; 