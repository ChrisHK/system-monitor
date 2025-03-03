const { pool } = require('../config/database');
const { handleError } = require('../utils/errorHandler');

// 獲取所有分類
const getCategories = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(`
            SELECT 
                c.*,
                COUNT(t.id) as tag_count
            FROM categories c
            LEFT JOIN tags t ON c.id = t.category_id
            WHERE c.is_active = true
            GROUP BY c.id
            ORDER BY c.name
        `);
        
        res.json({
            success: true,
            data: result.rows || []  // 確保返回空數組而不是 undefined
        });
    } catch (error) {
        handleError(res, error);
    } finally {
        client.release();
    }
};

// 獲取特定分類的標籤
const getCategoryTags = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const result = await client.query(`
            SELECT *
            FROM tags
            WHERE category_id = $1 AND is_active = true
            ORDER BY name
        `, [id]);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        handleError(res, error);
    } finally {
        client.release();
    }
};

// 創建新分類
const createCategory = async (req, res) => {
    const client = await pool.connect();
    try {
        const { name, description } = req.body;
        
        // 檢查是否已存在相同名稱的分類
        const existingCategory = await client.query(
            'SELECT id FROM categories WHERE name = $1 AND is_active = true',
            [name]
        );
        
        if (existingCategory.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Category with this name already exists'
            });
        }
        
        const result = await client.query(`
            INSERT INTO categories (name, description, created_by)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [name, description, req.user.id]);
        
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

// 更新分類
const updateCategory = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        
        // 檢查是否存在
        const existingCategory = await client.query(
            'SELECT id FROM categories WHERE id = $1 AND is_active = true',
            [id]
        );
        
        if (existingCategory.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }
        
        // 檢查新名稱是否與其他分類重複
        const duplicateCheck = await client.query(
            'SELECT id FROM categories WHERE name = $1 AND id != $2 AND is_active = true',
            [name, id]
        );
        
        if (duplicateCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Category with this name already exists'
            });
        }
        
        const result = await client.query(`
            UPDATE categories
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

// 刪除分類
const deleteCategory = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        
        // 開始事務
        await client.query('BEGIN');
        
        // 軟刪除分類
        await client.query(`
            UPDATE categories
            SET is_active = false, updated_at = NOW()
            WHERE id = $1
        `, [id]);
        
        // 軟刪除相關的標籤
        await client.query(`
            UPDATE tags
            SET is_active = false, updated_at = NOW()
            WHERE category_id = $1
        `, [id]);
        
        await client.query('COMMIT');
        
        res.json({
            success: true,
            message: 'Category deleted successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        handleError(res, error);
    } finally {
        client.release();
    }
};

module.exports = {
    getCategories,
    getCategoryTags,
    createCategory,
    updateCategory,
    deleteCategory
}; 