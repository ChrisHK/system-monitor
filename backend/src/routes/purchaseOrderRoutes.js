const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const purchaseOrderController = require('../controllers/purchaseOrderController');

// Get all purchase orders with filters
router.get('/', auth, purchaseOrderController.getPurchaseOrders);

// Get a specific purchase order by ID
router.get('/:id', auth, purchaseOrderController.getPurchaseOrderById);

// Create a new purchase order
router.post('/', auth, purchaseOrderController.createPurchaseOrder);

// Update a purchase order
router.put('/:id', auth, purchaseOrderController.updatePurchaseOrder);

// Delete a purchase order
router.delete('/:id', auth, purchaseOrderController.deletePurchaseOrder);

// Get purchase order formats
router.get('/formats/list', auth, purchaseOrderController.getPurchaseOrderFormats);

// Create a new purchase order format
router.post('/formats', auth, purchaseOrderController.createPurchaseOrderFormat);

// Update a purchase order format
router.put('/formats/:id', auth, purchaseOrderController.updatePurchaseOrderFormat);

// Delete a purchase order format
router.delete('/formats/:id', auth, purchaseOrderController.deletePurchaseOrderFormat);

// Download purchase order template
router.get('/template/download', auth, purchaseOrderController.downloadTemplate);

// Import purchase order from Excel
router.post('/import', auth, purchaseOrderController.importPurchaseOrder);

module.exports = router; 