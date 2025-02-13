const { pool } = require('../config/database');
const { handleError } = require('../utils/errorHandler');

// 獲取所有標籤
const getTags = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT 
                t.*,
                c.name as category_name
            FROM tags t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.is_active = true AND c.is_active = true
            ORDER BY c.name, t.name
        `);
        
        // 將標籤按分類分組
        const tagsByCategory = result.rows.reduce((acc, tag) => {
            if (!acc[tag.category_id]) {
                acc[tag.category_id] = [];
            }
            acc[tag.category_id].push(tag);
            return acc;
        }, {});
        
        res.json({
            success: true,
            data: tagsByCategory
        });
    } catch (error) {
        handleError(res, error);
    } finally {
        client.release();
    }
};

// 創建新標籤
const createTag = async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, category_id, description } = req.body;
        
        // 檢查分類是否存在
        const categoryExists = await client.query(
            'SELECT id FROM categories WHERE id = $1 AND is_active = true',
            [category_id]
        );
        
        if (categoryExists.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Category not found'
            });
        }
        
        // 檢查是否已存在相同名稱的標籤
        const existingTag = await client.query(
            'SELECT id FROM tags WHERE name = $1 AND category_id = $2 AND is_active = true',
            [name, category_id]
        );
        
        if (existingTag.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Tag with this name already exists in this category'
            });
        }
        
        const result = await client.query(`
            INSERT INTO tags (name, category_id, description, created_by)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [name, category_id, description, req.user.id]);
        
        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        handleError(res, error);
    } finally {
        client.release();
    }
};

// 更新標籤
const updateTag = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        
        // 檢查標籤是否存在
        const existingTag = await client.query(
            'SELECT category_id FROM tags WHERE id = $1 AND is_active = true',
            [id]
        );
        
        if (existingTag.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tag not found'
            });
        }
        
        // 檢查新名稱是否與同分類的其他標籤重複
        const duplicateCheck = await client.query(
            'SELECT id FROM tags WHERE name = $1 AND category_id = $2 AND id != $3 AND is_active = true',
            [name, existingTag.rows[0].category_id, id]
        );
        
        if (duplicateCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Tag with this name already exists in this category'
            });
        }
        
        const result = await client.query(`
            UPDATE tags
            SET name = $1, description = $2, updated_at = NOW()
            WHERE id = $3 AND is_active = true
            RETURNING *
        `, [name, description, id]);
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        handleError(res, error);
    } finally {
        client.release();
    }
};

// 刪除標籤
const deleteTag = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        
        const result = await client.query(`
            UPDATE tags
            SET is_active = false, updated_at = NOW()
            WHERE id = $1
            RETURNING id
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tag not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Tag deleted successfully'
        });
    } catch (error) {
        handleError(res, error);
    } finally {
        client.release();
    }
};

module.exports = {
    getTags,
    createTag,
    updateTag,
    deleteTag
}; 