const express = require('express');
const router = express.Router();
const pool = require('../db');
const { auth, checkGroup } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');
const { ValidationError } = require('../middleware/errorTypes');
const tagController = require('../controllers/tagController');

// Get all tag categories
router.get('/categories', auth, catchAsync(async (req, res) => {
    const result = await pool.query(`
        SELECT 
            tc.*, 
            COUNT(t.id) as tag_count
        FROM tag_categories tc
        LEFT JOIN tags t ON tc.id = t.category_id AND t.is_active = true
        WHERE tc.is_active = true
        GROUP BY tc.id
        ORDER BY tc.name
    `);
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
        [name.trim(), description?.trim(), req.user.id]
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
         SET name = $1, 
             description = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND is_active = true
         RETURNING *`,
        [name.trim(), description?.trim(), id]
    );
    
    if (result.rows.length === 0) {
        throw new ValidationError('Category not found or inactive');
    }
    
    res.json({ success: true, category: result.rows[0] });
}));

// Delete tag category (admin only)
router.delete('/categories/:id', auth, checkGroup(['admin']), catchAsync(async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if category has active tags
        const tagsCheck = await client.query(
            'SELECT COUNT(*) FROM tags WHERE category_id = $1 AND is_active = true',
            [id]
        );

        if (parseInt(tagsCheck.rows[0].count) > 0) {
            throw new ValidationError('Cannot delete category with active tags');
        }

        // Soft delete the category
        const result = await client.query(
            `UPDATE tag_categories 
             SET is_active = false,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND is_active = true
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            throw new ValidationError('Category not found or already inactive');
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}));

// Get all tags with category info
router.get('/', auth, catchAsync(async (req, res) => {
    const { category_id } = req.query;
    let query = `
        SELECT 
            t.*,
            tc.name as category_name,
            tc.description as category_description,
            (
                SELECT COALESCE(json_agg(tr.*), '[]'::json)
                FROM tag_relations tr
                WHERE tr.tag_id = t.id
            ) as relations
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

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verify category exists and is active
        const categoryCheck = await client.query(
            'SELECT id FROM tag_categories WHERE id = $1 AND is_active = true',
            [category_id]
        );
        if (categoryCheck.rows.length === 0) {
            throw new ValidationError('Invalid or inactive category');
        }

        // Check for duplicate tag name in the same category
        const duplicateCheck = await client.query(
            'SELECT id FROM tags WHERE category_id = $1 AND name = $2 AND is_active = true',
            [category_id, name.trim()]
        );
        if (duplicateCheck.rows.length > 0) {
            throw new ValidationError('Tag name already exists in this category');
        }

        // Create the tag
        const result = await client.query(
            `INSERT INTO tags (name, color, category_id, description, created_by)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [name.trim(), color || '#1890ff', category_id, description?.trim(), req.user.id]
        );

        await client.query('COMMIT');
        res.json({ success: true, tag: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}));

// Update tag
router.put('/:id', auth, catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name, color, description } = req.body;
    if (!name) throw new ValidationError('Tag name is required');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check if tag exists and get its category_id
        const tagCheck = await client.query(
            'SELECT category_id FROM tags WHERE id = $1 AND is_active = true',
            [id]
        );
        if (tagCheck.rows.length === 0) {
            throw new ValidationError('Tag not found or inactive');
        }

        // Check for duplicate tag name in the same category (excluding current tag)
        const duplicateCheck = await client.query(
            'SELECT id FROM tags WHERE category_id = $1 AND name = $2 AND id != $3 AND is_active = true',
            [tagCheck.rows[0].category_id, name.trim(), id]
        );
        if (duplicateCheck.rows.length > 0) {
            throw new ValidationError('Tag name already exists in this category');
        }

        // Update the tag
        const result = await client.query(
            `UPDATE tags 
             SET name = $1,
                 color = $2,
                 description = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4 AND is_active = true
             RETURNING *`,
            [name.trim(), color || '#1890ff', description?.trim(), id]
        );

        await client.query('COMMIT');
        res.json({ success: true, tag: result.rows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}));

// Delete tag
router.delete('/:id', auth, catchAsync(async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check for tag relations
        const relationsCheck = await client.query(
            'SELECT COUNT(*) FROM tag_relations WHERE tag_id = $1',
            [id]
        );

        if (parseInt(relationsCheck.rows[0].count) > 0) {
            // Soft delete relations first
            await client.query(
                `UPDATE tag_relations 
                 SET is_active = false,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE tag_id = $1`,
                [id]
            );
        }

        // Soft delete the tag
        const result = await client.query(
            `UPDATE tags 
             SET is_active = false,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND is_active = true
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            throw new ValidationError('Tag not found or already inactive');
        }

        await client.query('COMMIT');
        res.json({ success: true, message: 'Tag deleted successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}));

// Get tag relations
router.get('/:id/relations', auth, catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await pool.query(
        `SELECT * FROM tag_relations 
         WHERE tag_id = $1
         ORDER BY created_at DESC`,
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