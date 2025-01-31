const db = require('../config/database');
const ExcelJS = require('exceljs');
const { validatePurchaseOrder } = require('../utils/validation');
const { handleError } = require('../utils/errorHandler');

// Get all purchase orders with filters
const getPurchaseOrders = async (req, res) => {
    try {
        const { 
            search, 
            startDate, 
            endDate, 
            status,
            page = 1,
            pageSize = 10,
            sortField = 'created_at',
            sortOrder = 'DESC'
        } = req.query;

        let query = `
            SELECT 
                po.*,
                u.username as created_by_username
            FROM purchase_orders po
            LEFT JOIN users u ON po.created_by = u.id
            WHERE 1=1
        `;
        const values = [];
        let valueIndex = 1;

        if (search) {
            query += ` AND (po.po_name ILIKE $${valueIndex} OR po.po_note ILIKE $${valueIndex})`;
            values.push(`%${search}%`);
            valueIndex++;
        }

        if (startDate) {
            query += ` AND po.po_date >= $${valueIndex}`;
            values.push(startDate);
            valueIndex++;
        }

        if (endDate) {
            query += ` AND po.po_date <= $${valueIndex}`;
            values.push(endDate);
            valueIndex++;
        }

        if (status) {
            query += ` AND po.po_status = $${valueIndex}`;
            values.push(status);
            valueIndex++;
        }

        // Add sorting
        query += ` ORDER BY po.${sortField} ${sortOrder}`;

        // Add pagination
        const offset = (page - 1) * pageSize;
        query += ` LIMIT $${valueIndex} OFFSET $${valueIndex + 1}`;
        values.push(pageSize, offset);

        // Get total count
        const countQuery = query.replace(/SELECT.*FROM/, 'SELECT COUNT(*) FROM').split('ORDER BY')[0];
        const countResult = await db.query(countQuery, values.slice(0, -2));
        const totalCount = parseInt(countResult.rows[0].count);

        // Get paginated results
        const result = await db.query(query, values);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                current: parseInt(page),
                pageSize: parseInt(pageSize),
                total: totalCount
            }
        });
    } catch (error) {
        handleError(res, error);
    }
};

// Get a specific purchase order by ID
const getPurchaseOrderById = async (req, res) => {
    try {
        const { id } = req.params;

        const orderQuery = `
            SELECT 
                po.*,
                u.username as created_by_username
            FROM purchase_orders po
            LEFT JOIN users u ON po.created_by = u.id
            WHERE po.id = $1
        `;

        const itemsQuery = `
            SELECT * FROM purchase_order_items
            WHERE po_id = $1
            ORDER BY id
        `;

        const orderResult = await db.query(orderQuery, [id]);
        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Purchase order not found'
            });
        }

        const itemsResult = await db.query(itemsQuery, [id]);

        res.json({
            success: true,
            data: {
                order: orderResult.rows[0],
                items: itemsResult.rows
            }
        });
    } catch (error) {
        handleError(res, error);
    }
};

// Create a new purchase order
const createPurchaseOrder = async (req, res) => {
    try {
        const { order, items } = req.body;
        const validation = validatePurchaseOrder(order, items);
        
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validation.errors
            });
        }

        // Start transaction
        await db.query('BEGIN');

        // Insert order
        const orderResult = await db.query(`
            INSERT INTO purchase_orders (
                po_name, po_date, po_status, po_amount, po_note, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        `, [
            order.poName,
            order.poDate,
            order.poStatus || 'pending',
            order.poAmount,
            order.poNote,
            req.user.id
        ]);

        const poId = orderResult.rows[0].id;

        // Insert items
        for (const item of items) {
            await db.query(`
                INSERT INTO purchase_order_items (
                    po_id, item_no, description, quantity, unit_price, 
                    total_amount, supplier, remark
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                poId,
                item.itemNo,
                item.description,
                item.quantity,
                item.unitPrice,
                item.totalAmount,
                item.supplier,
                item.remark
            ]);
        }

        await db.query('COMMIT');

        res.json({
            success: true,
            message: 'Purchase order created successfully',
            data: { id: poId }
        });
    } catch (error) {
        await db.query('ROLLBACK');
        handleError(res, error);
    }
};

// Update a purchase order
const updatePurchaseOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { order, items } = req.body;
        const validation = validatePurchaseOrder(order, items);
        
        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validation.errors
            });
        }

        // Start transaction
        await db.query('BEGIN');

        // Update order
        await db.query(`
            UPDATE purchase_orders 
            SET po_name = $1, po_date = $2, po_status = $3, 
                po_amount = $4, po_note = $5
            WHERE id = $6
        `, [
            order.poName,
            order.poDate,
            order.poStatus,
            order.poAmount,
            order.poNote,
            id
        ]);

        // Delete existing items
        await db.query('DELETE FROM purchase_order_items WHERE po_id = $1', [id]);

        // Insert new items
        for (const item of items) {
            await db.query(`
                INSERT INTO purchase_order_items (
                    po_id, item_no, description, quantity, unit_price, 
                    total_amount, supplier, remark
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                id,
                item.itemNo,
                item.description,
                item.quantity,
                item.unitPrice,
                item.totalAmount,
                item.supplier,
                item.remark
            ]);
        }

        await db.query('COMMIT');

        res.json({
            success: true,
            message: 'Purchase order updated successfully'
        });
    } catch (error) {
        await db.query('ROLLBACK');
        handleError(res, error);
    }
};

// Delete a purchase order
const deletePurchaseOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM purchase_orders WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Purchase order not found'
            });
        }

        res.json({
            success: true,
            message: 'Purchase order deleted successfully'
        });
    } catch (error) {
        handleError(res, error);
    }
};

// Get purchase order formats
const getPurchaseOrderFormats = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                f.*,
                u.username as created_by_username
            FROM purchase_order_formats f
            LEFT JOIN users u ON f.created_by = u.id
            WHERE f.is_active = true
            ORDER BY f.created_at DESC
        `);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        handleError(res, error);
    }
};

// Create a new purchase order format
const createPurchaseOrderFormat = async (req, res) => {
    try {
        const { formatName, description, formatConfig } = req.body;

        const result = await db.query(`
            INSERT INTO purchase_order_formats (
                format_name, description, format_config, created_by
            ) VALUES ($1, $2, $3, $4)
            RETURNING id
        `, [formatName, description, formatConfig, req.user.id]);

        res.json({
            success: true,
            message: 'Format created successfully',
            data: { id: result.rows[0].id }
        });
    } catch (error) {
        handleError(res, error);
    }
};

// Update a purchase order format
const updatePurchaseOrderFormat = async (req, res) => {
    try {
        const { id } = req.params;
        const { formatName, description, formatConfig, isActive } = req.body;

        const result = await db.query(`
            UPDATE purchase_order_formats
            SET format_name = $1, description = $2, format_config = $3, is_active = $4
            WHERE id = $5
            RETURNING id
        `, [formatName, description, formatConfig, isActive, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Format not found'
            });
        }

        res.json({
            success: true,
            message: 'Format updated successfully'
        });
    } catch (error) {
        handleError(res, error);
    }
};

// Delete a purchase order format
const deletePurchaseOrderFormat = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(`
            UPDATE purchase_order_formats
            SET is_active = false
            WHERE id = $1
            RETURNING id
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Format not found'
            });
        }

        res.json({
            success: true,
            message: 'Format deleted successfully'
        });
    } catch (error) {
        handleError(res, error);
    }
};

// Download purchase order template
const downloadTemplate = async (req, res) => {
    try {
        const { formatId } = req.query;
        
        // Get format configuration
        const formatResult = await db.query(
            'SELECT * FROM purchase_order_formats WHERE id = $1 AND is_active = true',
            [formatId]
        );

        if (formatResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Format not found'
            });
        }

        const format = formatResult.rows[0];
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Purchase Order');

        // Set up columns based on format configuration
        worksheet.columns = format.format_config.columns.map(col => ({
            header: col.header,
            key: col.key,
            width: col.width || 15
        }));

        // Add any additional formatting
        worksheet.getRow(1).font = { bold: true };

        // Generate the Excel file
        const buffer = await workbook.xlsx.writeBuffer();

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=purchase_order_template.xlsx`);
        res.send(buffer);
    } catch (error) {
        handleError(res, error);
    }
};

// Import purchase order from Excel
const importPurchaseOrder = async (req, res) => {
    try {
        const { formatId } = req.body;
        const file = req.files.file;

        // Get format configuration
        const formatResult = await db.query(
            'SELECT * FROM purchase_order_formats WHERE id = $1 AND is_active = true',
            [formatId]
        );

        if (formatResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid format'
            });
        }

        const format = formatResult.rows[0];
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(file.data);

        const worksheet = workbook.getWorksheet(1);
        const rows = [];

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) { // Skip header row
                const rowData = {};
                format.format_config.columns.forEach((col, index) => {
                    rowData[col.key] = row.getCell(index + 1).value;
                });
                rows.push(rowData);
            }
        });

        // Validate and process the data
        // TODO: Implement data validation and processing

        res.json({
            success: true,
            message: 'File imported successfully',
            data: rows
        });
    } catch (error) {
        handleError(res, error);
    }
};

module.exports = {
    getPurchaseOrders,
    getPurchaseOrderById,
    createPurchaseOrder,
    updatePurchaseOrder,
    deletePurchaseOrder,
    getPurchaseOrderFormats,
    createPurchaseOrderFormat,
    updatePurchaseOrderFormat,
    deletePurchaseOrderFormat,
    downloadTemplate,
    importPurchaseOrder
}; 