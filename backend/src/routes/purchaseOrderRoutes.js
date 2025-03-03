const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const purchaseOrderController = require('../controllers/purchaseOrderController');
const { pool } = require('../db');
const moment = require('moment');

// Get latest PO number
router.get('/latest-number', auth, async (req, res) => {
    const { date } = req.query;
    try {
        // Get today's date if not provided
        const searchDate = date || moment().format('YYYYMMDD');
        
        // Search for PO numbers with the format PO<YYYYMMDD><###>
        const result = await pool.query(`
            SELECT po_number 
            FROM purchase_orders 
            WHERE po_number LIKE $1 
            ORDER BY po_number DESC 
            LIMIT 1
        `, [`PO${searchDate}%`]);

        let latestNumber = 0;
        if (result.rows.length > 0) {
            // Extract the sequence number from PO number (last 3 digits)
            const match = result.rows[0].po_number.match(/\d{3}$/);
            if (match) {
                latestNumber = parseInt(match[0]);
            }
        }

        res.json({
            success: true,
            number: latestNumber
        });
    } catch (error) {
        console.error('Error getting latest PO number:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Failed to get latest PO number',
                details: error.message
            }
        });
    }
});

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