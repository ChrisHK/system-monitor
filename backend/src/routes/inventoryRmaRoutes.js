const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { checkMainPermission } = require('../middleware/checkPermission');
const { catchAsync } = require('../middleware/errorHandler');
const { 
    getRmaItems,
    createRmaItem,
    updateRmaItem,
    deleteRmaItem,
    getRmaItemById,
    processRmaItem,
    completeRmaItem,
    failRmaItem,
    searchRmaItems
} = require('../controllers/inventoryRmaController');

// 獲取 RMA 列表（需要 inventory_rma 權限）
router.get('/', auth, checkMainPermission('inventory_rma'), catchAsync(getRmaItems));

// 搜索 RMA 記錄
router.get('/search/:serialNumber', auth, checkMainPermission('inventory_rma'), catchAsync(searchRmaItems));

// 創建新的 RMA 記錄
router.post('/', auth, checkMainPermission('inventory_rma'), catchAsync(createRmaItem));

// 獲取特定 RMA 記錄
router.get('/:id', auth, checkMainPermission('inventory_rma'), catchAsync(getRmaItemById));

// 更新 RMA 記錄
router.put('/:id', auth, checkMainPermission('inventory_rma'), catchAsync(updateRmaItem));

// 刪除 RMA 記錄
router.delete('/:id', auth, checkMainPermission('inventory_rma'), catchAsync(deleteRmaItem));

// 處理 RMA 記錄
router.post('/:id/process', auth, checkMainPermission('inventory_rma'), catchAsync(processRmaItem));

// 完成 RMA 記錄
router.post('/:id/complete', auth, checkMainPermission('inventory_rma'), catchAsync(completeRmaItem));

// 標記 RMA 記錄為失敗
router.post('/:id/fail', auth, checkMainPermission('inventory_rma'), catchAsync(failRmaItem));

module.exports = router; 