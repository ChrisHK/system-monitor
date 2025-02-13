const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const categoryController = require('../controllers/categoryController');

// 獲取所有分類
router.get('/', auth, categoryController.getCategories);

// 獲取特定分類的標籤
router.get('/:id/tags', auth, categoryController.getCategoryTags);

// 創建新分類
router.post('/', auth, categoryController.createCategory);

// 更新分類
router.put('/:id', auth, categoryController.updateCategory);

// 刪除分類
router.delete('/:id', auth, categoryController.deleteCategory);

module.exports = router; 