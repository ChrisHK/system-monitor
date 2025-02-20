const express = require('express');
const router = express.Router();
const { processInventoryData, getLogs, getProcessingStatus, clearLogs, deleteLog } = require('../controllers/dataProcessController');
const checksumValidator = require('../middleware/checksumValidator');
const { auth } = require('../middleware/auth');

// 處理庫存數據 (需要 checksum 驗證)
router.post('/inventory', auth, checksumValidator, processInventoryData);

// 獲取處理日誌
router.get('/logs', auth, getLogs);

// 獲取處理狀態
router.get('/status/:batchId', auth, getProcessingStatus);

// 清理日誌
router.post('/logs/clean', auth, clearLogs);

// 刪除特定日誌
router.delete('/logs/:batchId', auth, deleteLog);

module.exports = router; 