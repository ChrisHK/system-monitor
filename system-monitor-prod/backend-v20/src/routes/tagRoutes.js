const express = require('express');
const router = express.Router();
const pool = require('../db');
const { auth, checkGroup } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');
const { ValidationError } = require('../middleware/errorTypes');
const tagController = require('../controllers/tagController');

// Get all tag categories (accessible by all authenticated users)
router.get('/categories', auth, catchAsync(async (req, res) => {
    const result = await pool.query(
        'SELECT * FROM tag_categories WHERE is_active = true ORDER BY name'
    );
    res.json({ success: true, categories: result.rows });
}));

// Create tag category (admin only)
router.post('/categories', auth, checkGroup(['admin']), catchAsync(async (req, res) => {
    const { name, description } = req.body;
    if (!name) throw new ValidationError('Category name is required');

    const result = await pool.query(
        `INSERT INTO tag_categories (name, description, created_by)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, description, req.user.id]
    );
    res.json({ success: true, category: result.rows[0] });
}));

// Update tag category (admin only)
router.put('/categories/:id', auth, checkGroup(['admin']), catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name) throw new ValidationError('Category name is required');

    const result = await pool.query(
        `UPDATE tag_categories 
         SET name = $1, description = $2
         WHERE id = $3 AND is_active = true
         RETURNING *`,
        [name, description, id]
    );
    
    if (result.rows.length === 0) {
        throw new ValidationError('Category not found or inactive');
    }
    
    res.json({ success: true, category: result.rows[0] });
}));

// Delete tag category (admin only)
router.delete('/categories/:id', auth, checkGroup(['admin']), catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await pool.query(
        `UPDATE tag_categories 
         SET is_active = false 
         WHERE id = $1 AND is_active = true
         RETURNING *`,
        [id]
    );
    
    if (result.rows.length === 0) {
        throw new ValidationError('Category not found or already inactive');
    }
    
    res.json({ success: true, message: 'Category deleted successfully' });
}));

// Get all tags
router.get('/', auth, catchAsync(async (req, res) => {
    const { category_id } = req.query;
    let query = `
        SELECT t.*, tc.name as category_name 
        FROM tags t
        JOIN tag_categories tc ON t.category_id = tc.id
        WHERE t.is_active = true AND tc.is_active = true
    `;
    const params = [];

    if (category_id) {
        query += ' AND t.category_id = $1';
        params.push(category_id);
    }

    query += ' ORDER BY tc.name, t.name';

    const result = await pool.query(query, params);
    res.json({ success: true, tags: result.rows });
}));

// Create tag
router.post('/', auth, catchAsync(async (req, res) => {
    const { name, color, category_id, description } = req.body;
    if (!name || !category_id) {
        throw new ValidationError('Tag name and category are required');
    }

    // Verify category exists and is active
    const categoryCheck = await pool.query(
        'SELECT id FROM tag_categories WHERE id = $1 AND is_active = true',
        [category_id]
    );
    if (categoryCheck.rows.length === 0) {
        throw new ValidationError('Invalid or inactive category');
    }

    const result = await pool.query(
        `INSERT INTO tags (name, color, category_id, description, created_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name, color || '#1890ff', category_id, description, req.user.id]
    );
    res.json({ success: true, tag: result.rows[0] });
}));

// Update tag
router.put('/:id', auth, catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, color, description } = req.body;
    if (!name) throw new ValidationError('Tag name is required');

    const result = await pool.query(
        `UPDATE tags 
         SET name = $1, color = $2, description = $3
         WHERE id = $4 AND is_active = true
         RETURNING *`,
        [name, color || '#1890ff', description, id]
    );
    
    if (result.rows.length === 0) {
        throw new ValidationError('Tag not found or inactive');
    }
    
    res.json({ success: true, tag: result.rows[0] });
}));

// Delete tag
router.delete('/:id', auth, catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await pool.query(
        `UPDATE tags 
         SET is_active = false 
         WHERE id = $1 AND is_active = true
         RETURNING *`,
        [id]
    );
    
    if (result.rows.length === 0) {
        throw new ValidationError('Tag not found or already inactive');
    }
    
    res.json({ success: true, message: 'Tag deleted successfully' });
}));

// Get tag relations
router.get('/:id/relations', auth, catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await pool.query(
        `SELECT * FROM tag_relations WHERE tag_id = $1`,
        [id]
    );
    res.json({ success: true, relations: result.rows });
}));

// 獲取所有標籤
router.get('/', auth, tagController.getTags);

// 創建新標籤
router.post('/', auth, tagController.createTag);

// 更新標籤
router.put('/:id', auth, tagController.updateTag);

// 刪除標籤
router.delete('/:id', auth, tagController.deleteTag);

module.exports = router; 