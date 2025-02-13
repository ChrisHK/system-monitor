const { pool } = require('../config/database');
const ExcelJS = require('exceljs');
const { validatePurchaseOrder } = require('../utils/validation');
const { handleError } = require('../utils/errorHandler');

// Get all purchase orders with filters
const getPurchaseOrders = async (req, res) => {
    const client = await pool.connect();
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

        // 構建基本查詢條件
        let conditions = ['1=1'];
        const values = [];
        let valueIndex = 1;

        if (search) {
            conditions.push(`(po.po_number ILIKE $${valueIndex} OR po.notes ILIKE $${valueIndex})`);
            values.push(`%${search}%`);
            valueIndex++;
        }

        if (startDate) {
            conditions.push(`po.order_date >= $${valueIndex}`);
            values.push(startDate);
            valueIndex++;
        }

        if (endDate) {
            conditions.push(`po.order_date <= $${valueIndex}`);
            values.push(endDate);
            valueIndex++;
        }

        if (status) {
            conditions.push(`po.status = $${valueIndex}`);
            values.push(status);
            valueIndex++;
        }

        // 構建 WHERE 子句
        const whereClause = conditions.join(' AND ');

        // 獲取總數
        const countQuery = `
            SELECT COUNT(*) as total
            FROM purchase_orders po
            WHERE ${whereClause}
        `;
        
        const countResult = await client.query(countQuery, values);
        const totalCount = parseInt(countResult.rows[0].total);

        // 構建主查詢
        const query = `
            SELECT 
                po.*,
                u.username as created_by_username
            FROM purchase_orders po
            LEFT JOIN users u ON po.created_by = u.id
            WHERE ${whereClause}
            ORDER BY po.${sortField} ${sortOrder}
            LIMIT $${valueIndex} OFFSET $${valueIndex + 1}
        `;

        // 添加分頁參數
        const offset = (page - 1) * pageSize;
        values.push(pageSize, offset);

        // 執行主查詢
        const result = await client.query(query, values);

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
        console.error('Error in getPurchaseOrders:', error);
        handleError(res, error);
    } finally {
        client.release();
    }
};

// Get a specific purchase order by ID
const getPurchaseOrderById = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;

        // Get PO data
        const orderQuery = `
            SELECT 
                po.*,
                u.username as created_by_username
            FROM purchase_orders po
            LEFT JOIN users u ON po.created_by = u.id
            WHERE po.id = $1
        `;

        // Get PO items with their categories and tags
        const itemsQuery = `
            SELECT 
                poi.*,
                COALESCE(
                    json_agg(
                        CASE WHEN pic.category_id IS NOT NULL THEN
                            json_build_object(
                                'category_id', pic.category_id,
                                'tag_id', pic.tag_id,
                                'tag_name', t.name
                            )
                        ELSE NULL END
                    ) FILTER (WHERE pic.category_id IS NOT NULL),
                    '[]'
                ) as categories
            FROM purchase_order_items poi
            LEFT JOIN po_item_categories pic ON poi.id = pic.po_item_id
            LEFT JOIN tags t ON t.id = pic.tag_id
            WHERE poi.po_id = $1
            GROUP BY poi.id
            ORDER BY poi.id
        `;

        // Get all active categories in the correct order
        const categoriesQuery = `
            SELECT DISTINCT tc.id, tc.name,
                CASE tc.name
                    WHEN 'Brand' THEN 1
                    WHEN 'Model' THEN 2
                    WHEN 'CPU' THEN 3
                    WHEN 'Memory' THEN 4
                    WHEN 'Storage' THEN 5
                    WHEN 'Graphics Card' THEN 6
                    WHEN 'Touch Screen' THEN 7
                    WHEN 'Condition' THEN 8
                    WHEN 'Damages' THEN 9
                    ELSE 10
                END as sort_order
            FROM tag_categories tc
            WHERE tc.is_active = true
            ORDER BY sort_order
        `;

        const orderResult = await client.query(orderQuery, [id]);
        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Purchase order not found'
            });
        }

        const itemsResult = await client.query(itemsQuery, [id]);
        const categoriesResult = await client.query(categoriesQuery);

        res.json({
            success: true,
            data: {
                order: orderResult.rows[0],
                items: itemsResult.rows.map(item => ({
                    ...item,
                    categories: item.categories.filter(Boolean)
                })),
                categories: categoriesResult.rows
            }
        });
    } catch (error) {
        handleError(res, error);
    } finally {
        client.release();
    }
};

// Create a new purchase order
const createPurchaseOrder = async (req, res) => {
    const client = await pool.connect();
    try {
        const data = req.body;
        
        // Start transaction
        await client.query('BEGIN');

        // Calculate total amount
        const totalAmount = data.items.reduce((sum, item) => sum + Number(item.cost), 0);

        // Insert order
        const orderResult = await client.query(`
            INSERT INTO purchase_orders (
                po_number, order_date, supplier, status, total_amount, notes, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `, [
            data.order.po_number,
            data.order.order_date,
            data.order.supplier,
            data.order.status || 'draft',
            totalAmount,
            data.order.notes || '',
            req.user?.id || null
        ]);

        const poId = orderResult.rows[0].id;

        // Insert items and their categories
        for (const item of data.items) {
            // Insert the item first
            const itemResult = await client.query(`
                INSERT INTO purchase_order_items (
                    po_id, serialnumber, cost, so, note
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            `, [
                poId,
                item.serialnumber,
                Number(item.cost),
                item.so || '',
                item.note || ''
            ]);

            const itemId = itemResult.rows[0].id;

            // Insert category relationships if they exist
            if (Array.isArray(item.categories)) {
                // Delete any existing category relationships first
                await client.query(`
                    DELETE FROM po_item_categories 
                    WHERE po_item_id = $1
                `, [itemId]);

                // Insert new category relationships
                for (const cat of item.categories) {
                    if (cat.category_id && cat.tag_id) {
                        await client.query(`
                            INSERT INTO po_item_categories (
                                po_item_id, category_id, tag_id
                            ) VALUES ($1, $2, $3)
                        `, [itemId, cat.category_id, cat.tag_id]);
                    }
                }
            }
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Purchase order created successfully',
            data: { id: poId }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({
            success: false,
            error: {
                message: error.message,
                code: error.code || 'INTERNAL_ERROR'
            }
        });
    } finally {
        client.release();
    }
};

// Update a purchase order
const updatePurchaseOrder = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { order, items } = req.body;
        
        console.log('Updating PO:', { id, order, items });

        // Start transaction
        await client.query('BEGIN');

        // Calculate total amount
        const totalAmount = items.reduce((sum, item) => sum + Number(item.cost), 0);

        // Update order
        const orderResult = await client.query(`
            UPDATE purchase_orders 
            SET po_number = $1, 
                order_date = $2, 
                supplier = $3, 
                status = $4, 
                total_amount = $5, 
                notes = $6,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
            RETURNING id
        `, [
            order.po_number,
            order.order_date,
            order.supplier,
            order.status,
            totalAmount,
            order.notes,
            id
        ]);

        if (orderResult.rows.length === 0) {
            throw new Error('Purchase order not found');
        }

        // Delete existing items and their category relationships
        await client.query('DELETE FROM po_item_categories WHERE po_item_id IN (SELECT id FROM purchase_order_items WHERE po_id = $1)', [id]);
        await client.query('DELETE FROM purchase_order_items WHERE po_id = $1', [id]);

        // Insert new items
        for (const item of items) {
            // Insert the item first
            const itemResult = await client.query(`
                INSERT INTO purchase_order_items (
                    po_id, serialnumber, cost, so, note
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING id
            `, [
                id,
                item.serialnumber,
                item.cost,
                item.so || '',
                item.note || ''
            ]);

            const itemId = itemResult.rows[0].id;

            // Insert category relationships if they exist
            if (item.categories && Array.isArray(item.categories)) {
                for (const cat of item.categories) {
                    await client.query(`
                        INSERT INTO po_item_categories (
                            po_item_id, category_id, tag_id
                        ) VALUES ($1, $2, $3)
                    `, [itemId, cat.category_id, cat.tag_id]);
                }
            }
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Purchase order updated successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating purchase order:', error);
        res.status(500).json({
            success: false,
            error: {
                message: error.message,
                code: error.code || 'INTERNAL_ERROR'
            }
        });
    } finally {
        client.release();
    }
};

// Delete a purchase order
const deletePurchaseOrder = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;

        const result = await client.query(
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
    } finally {
        client.release();
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