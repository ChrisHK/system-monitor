const pool = require('../db');
const { createLogger } = require('../utils/logger');
const logger = createLogger('inventory-rma');

// 獲取 RMA 項目列表
const getRmaItems = async (req, res) => {
    const client = await pool.connect();
    try {
        const { page = 1, limit = 50, status } = req.query;
        const offset = (page - 1) * limit;

        // 構建基礎查詢
        let query = `
            SELECT 
                ir.*,
                sr.store_id,
                sr.store_status,
                sr.inventory_status,
                sr.reason as store_reason,
                sr.notes as store_notes,
                s.name as store_name,
                sys.serialnumber,
                sys.model,
                sys.manufacturer,
                sys.computername,
                u.username as created_by_name,
                pu.username as processed_by_name,
                cu.username as completed_by_name
            FROM inventory_rma ir
            LEFT JOIN store_rma sr ON ir.store_rma_id = sr.id
            LEFT JOIN stores s ON sr.store_id = s.id
            LEFT JOIN system_records sys ON sr.record_id = sys.id
            LEFT JOIN users u ON ir.created_by = u.id
            LEFT JOIN users pu ON ir.processed_by = pu.id
            LEFT JOIN users cu ON ir.completed_by = cu.id
        `;

        const params = [];
        const conditions = [];

        // 添加狀態過濾
        if (status) {
            conditions.push(`ir.status = $${params.length + 1}`);
            params.push(status);
        }

        // 組合 WHERE 子句
        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(' AND ')}`;
        }

        // 添加排序和分頁
        query += ` 
            ORDER BY ir.created_at DESC 
            LIMIT $${params.length + 1} 
            OFFSET $${params.length + 2}
        `;
        params.push(limit, offset);

        // 執行查詢
        const result = await client.query(query, params);

        // 獲取總數
        const countQuery = `
            SELECT COUNT(*) 
            FROM inventory_rma ir
            ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
        `;
        const countResult = await client.query(countQuery, status ? [status] : []);

        // 按狀態分組
        const itemsByStatus = {
            receive: [],
            process: [],
            complete: [],
            failed: []
        };

        result.rows.forEach(item => {
            if (itemsByStatus[item.status]) {
                itemsByStatus[item.status].push(item);
            }
        });

        res.json({
            success: true,
            items: result.rows,
            itemsByStatus,
            total: parseInt(countResult.rows[0].count),
            page: parseInt(page),
            totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
        });

    } catch (error) {
        logger.error('Error fetching RMA items:', {
            error: error.message,
            code: error.code,
            detail: error.detail,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        res.status(500).json({
            success: false,
            error: 'Failed to fetch RMA items',
            details: error.message
        });
    } finally {
        client.release();
    }
};

// 搜索 RMA 記錄
const searchRmaItems = async (req, res) => {
    const client = await pool.connect();
    try {
        const { serialNumber } = req.params;
        
        const query = `
            WITH latest_records AS (
                SELECT DISTINCT ON (serialnumber) *
                FROM system_records
                WHERE is_current = true
                ORDER BY serialnumber, created_at DESC
            )
            SELECT 
                r.*,
                lr.manufacturer,
                lr.model,
                lr.computername,
                s.name as store_name,
                u.username as created_by_name,
                pu.username as processed_by_name,
                cu.username as completed_by_name,
                (
                    SELECT json_agg(json_build_object(
                        'action', h.action,
                        'old_status', h.old_status,
                        'new_status', h.new_status,
                        'changed_fields', h.changed_fields,
                        'notes', h.notes,
                        'created_at', h.created_at,
                        'created_by', u2.username
                    ) ORDER BY h.created_at DESC)
                    FROM rma_history h
                    LEFT JOIN users u2 ON h.created_by = u2.id
                    WHERE h.rma_id = r.id
                ) as history
            FROM rma_records r
            LEFT JOIN latest_records lr ON r.serialnumber = lr.serialnumber
            LEFT JOIN stores s ON r.store_id = s.id
            LEFT JOIN users u ON r.created_by = u.id
            LEFT JOIN users pu ON r.processed_by = pu.id
            LEFT JOIN users cu ON r.completed_by = cu.id
            WHERE r.serialnumber ILIKE $1
            ORDER BY r.created_at DESC
        `;
        
        const result = await client.query(query, [`%${serialNumber}%`]);
        
        // 記錄搜索結果
        logger.debug('RMA search results:', {
            serialNumber,
            matchCount: result.rows.length,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            items: result.rows
        });
    } catch (error) {
        logger.error('Error searching RMA items:', {
            error: error.message,
            serialNumber: req.params.serialNumber,
            timestamp: new Date().toISOString()
        });
        res.status(500).json({
            success: false,
            error: 'Failed to search RMA items',
            details: error.message
        });
    } finally {
        client.release();
    }
};

// 創建新的 RMA 記錄
const createRmaItem = async (req, res) => {
    const client = await pool.connect();
    try {
        const { 
            serialnumber,
            issue_description,
            store_id,
            is_warranty,
            warranty_info
        } = req.body;

        // 驗證必填字段
        if (!serialnumber || !issue_description || !store_id) {
            throw new Error('Missing required fields');
        }

        // 檢查序列號是否存在
        const deviceCheck = await client.query(
            'SELECT id FROM system_records WHERE serialnumber = $1 AND is_current = true',
            [serialnumber]
        );

        if (deviceCheck.rows.length === 0) {
            throw new Error('Device not found with the provided serial number');
        }

        await client.query('BEGIN');

        // 創建 RMA 記錄
        const result = await client.query(
            `INSERT INTO rma_records (
                serialnumber,
                issue_description,
                store_id,
                is_warranty,
                warranty_info,
                status,
                created_by,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, 'receive', $6, CURRENT_TIMESTAMP)
            RETURNING *`,
            [
                serialnumber,
                issue_description,
                store_id,
                is_warranty,
                warranty_info,
                req.user.id
            ]
        );

        // 創建歷史記錄
        await client.query(
            `INSERT INTO rma_history (
                rma_id,
                action,
                new_status,
                changed_fields,
                created_by
            ) VALUES ($1, 'create', 'receive', $2, $3)`,
            [
                result.rows[0].id,
                JSON.stringify({
                    serialnumber,
                    issue_description,
                    store_id,
                    is_warranty,
                    warranty_info
                }),
                req.user.id
            ]
        );

        await client.query('COMMIT');

        // 記錄創建結果
        logger.info('Created new RMA record:', {
            id: result.rows[0].id,
            serialnumber,
            store_id,
            created_by: req.user.id,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            item: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error creating RMA item:', {
            error: error.message,
            body: req.body,
            user: req.user.id,
            timestamp: new Date().toISOString()
        });
        res.status(400).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
};

// 更新 RMA 記錄
const updateRmaItem = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const {
            issue_description,
            diagnosis,
            solution,
            notes,
            cost,
            parts_used,
            is_warranty,
            warranty_info
        } = req.body;

        await client.query('BEGIN');

        // 檢查記錄是否存在
        const existingRecord = await client.query(
            'SELECT status FROM rma_records WHERE id = $1 FOR UPDATE',
            [id]
        );

        if (existingRecord.rows.length === 0) {
            throw new Error('RMA record not found');
        }

        // 只允許在處理中狀態更新某些字段
        if (existingRecord.rows[0].status !== 'process' && 
            (diagnosis || solution || cost || parts_used)) {
            throw new Error('Can only update diagnosis, solution, cost and parts during processing');
        }

        const oldRecord = await client.query(
            'SELECT * FROM rma_records WHERE id = $1',
            [id]
        );

        const result = await client.query(
            `UPDATE rma_records 
            SET 
                issue_description = COALESCE($1, issue_description),
                diagnosis = COALESCE($2, diagnosis),
                solution = COALESCE($3, solution),
                notes = COALESCE($4, notes),
                cost = COALESCE($5, cost),
                parts_used = COALESCE($6, parts_used),
                is_warranty = COALESCE($7, is_warranty),
                warranty_info = COALESCE($8, warranty_info),
                updated_at = CURRENT_TIMESTAMP,
                updated_by = $9
            WHERE id = $10
            RETURNING *`,
            [
                issue_description,
                diagnosis,
                solution,
                notes,
                cost,
                parts_used,
                is_warranty,
                warranty_info,
                req.user.id,
                id
            ]
        );

        // 計算變更的字段
        const changedFields = {};
        const fields = [
            'issue_description',
            'diagnosis',
            'solution',
            'notes',
            'cost',
            'parts_used',
            'is_warranty',
            'warranty_info'
        ];

        fields.forEach(field => {
            if (req.body[field] !== undefined && 
                JSON.stringify(oldRecord.rows[0][field]) !== JSON.stringify(req.body[field])) {
                changedFields[field] = {
                    old: oldRecord.rows[0][field],
                    new: req.body[field]
                };
            }
        });

        // 創建歷史記錄
        if (Object.keys(changedFields).length > 0) {
            await client.query(
                `INSERT INTO rma_history (
                    rma_id,
                    action,
                    old_status,
                    new_status,
                    changed_fields,
                    created_by
                ) VALUES ($1, 'update', $2, $2, $3, $4)`,
                [
                    id,
                    oldRecord.rows[0].status,
                    JSON.stringify(changedFields),
                    req.user.id
                ]
            );
        }

        await client.query('COMMIT');

        // 記錄更新結果
        logger.info('Updated RMA record:', {
            id,
            updatedBy: req.user.id,
            changedFields: Object.keys(changedFields),
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            item: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error updating RMA item:', {
            error: error.message,
            id: req.params.id,
            user: req.user.id,
            timestamp: new Date().toISOString()
        });
        res.status(400).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
};

// 刪除 RMA 記錄
const deleteRmaItem = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;

        // 檢查用戶權限
        if (req.user.group_name !== 'admin') {
            throw new Error('Only admin users can delete RMA records');
        }

        await client.query('BEGIN');

        // 獲取記錄信息用於日誌
        const record = await client.query(
            'SELECT * FROM inventory_rma WHERE id = $1',
            [id]
        );

        if (record.rows.length === 0) {
            throw new Error('RMA record not found');
        }

        // 刪除記錄
        await client.query(
            'DELETE FROM inventory_rma WHERE id = $1',
            [id]
        );

        await client.query('COMMIT');

        // 記錄刪除操作
        logger.info('Deleted RMA record:', {
            id,
            serialnumber: record.rows[0].serialnumber,
            deletedBy: req.user.id,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'RMA record deleted successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error deleting RMA item:', {
            error: error.message,
            id: req.params.id,
            user: req.user.id,
            timestamp: new Date().toISOString()
        });
        res.status(400).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
};

// 獲取特定 RMA 記錄
const getRmaItemById = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;

        const query = `
            WITH latest_records AS (
                SELECT DISTINCT ON (serialnumber) *
                FROM system_records
                WHERE is_current = true
                ORDER BY serialnumber, created_at DESC
            )
            SELECT 
                r.*,
                lr.manufacturer,
                lr.model,
                lr.computername,
                s.name as store_name,
                u.username as created_by_name,
                pu.username as processed_by_name,
                cu.username as completed_by_name,
                (
                    SELECT json_agg(json_build_object(
                        'action', h.action,
                        'old_status', h.old_status,
                        'new_status', h.new_status,
                        'changed_fields', h.changed_fields,
                        'notes', h.notes,
                        'created_at', h.created_at,
                        'created_by', u2.username
                    ) ORDER BY h.created_at DESC)
                    FROM rma_history h
                    LEFT JOIN users u2 ON h.created_by = u2.id
                    WHERE h.rma_id = r.id
                ) as history
            FROM rma_records r
            LEFT JOIN latest_records lr ON r.serialnumber = lr.serialnumber
            LEFT JOIN stores s ON r.store_id = s.id
            LEFT JOIN users u ON r.created_by = u.id
            LEFT JOIN users pu ON r.processed_by = pu.id
            LEFT JOIN users cu ON r.completed_by = cu.id
            WHERE r.id = $1
        `;

        const result = await client.query(query, [id]);

        if (result.rows.length === 0) {
            throw new Error('RMA record not found');
        }

        res.json({
            success: true,
            item: result.rows[0]
        });
    } catch (error) {
        logger.error('Error fetching RMA item:', {
            error: error.message,
            id: req.params.id,
            timestamp: new Date().toISOString()
        });
        res.status(404).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
};

// 處理 RMA 記錄
const processRmaItem = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { diagnosis } = req.body;

        if (!diagnosis) {
            throw new Error('Diagnosis is required to process RMA');
        }

        await client.query('BEGIN');

        // 檢查記錄是否存在且狀態是否正確
        const checkResult = await client.query(`
            SELECT ir.*, sr.id as store_rma_id
            FROM (
                SELECT * FROM inventory_rma WHERE id = $1 FOR UPDATE
            ) ir
            LEFT JOIN store_rma sr ON ir.store_rma_id = sr.id
            WHERE ir.id = $1
        `, [id]);

        if (checkResult.rows.length === 0) {
            throw new Error('RMA record not found');
        }

        const rmaItem = checkResult.rows[0];
        if (rmaItem.status !== 'receive') {
            throw new Error('Can only process RMA items in receive status');
        }

        // 更新 inventory_rma 狀態
        const result = await client.query(`
            UPDATE inventory_rma 
            SET 
                status = 'process',
                diagnosis = $1,
                processed_at = CURRENT_TIMESTAMP,
                processed_by = $2
            WHERE id = $3
            RETURNING *
        `, [diagnosis, req.user.id, id]);

        // 更新 store_rma 狀態
        if (rmaItem.store_rma_id) {
            await client.query(`
                UPDATE store_rma
                SET 
                    inventory_status = 'process'::rma_inventory_status,
                    diagnosis = $1,
                    processed_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [diagnosis, rmaItem.store_rma_id]);
        }

        await client.query('COMMIT');

        // 記錄處理操作
        logger.info('Processed RMA record:', {
            id,
            processedBy: req.user.id,
            storeRmaId: rmaItem.store_rma_id,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            item: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error processing RMA item:', {
            error: error.message,
            id: req.params.id,
            user: req.user.id,
            timestamp: new Date().toISOString()
        });
        res.status(400).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
};

// 完成 RMA 記錄
const completeRmaItem = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { solution } = req.body;

        if (!solution) {
            throw new Error('Solution is required to complete RMA');
        }

        await client.query('BEGIN');

        // 檢查記錄是否存在且狀態是否正確
        const checkResult = await client.query(`
            SELECT ir.*, sr.id as store_rma_id
            FROM (
                SELECT * FROM inventory_rma WHERE id = $1 FOR UPDATE
            ) ir
            LEFT JOIN store_rma sr ON ir.store_rma_id = sr.id
            WHERE ir.id = $1
        `, [id]);

        if (checkResult.rows.length === 0) {
            throw new Error('RMA record not found');
        }

        const rmaItem = checkResult.rows[0];
        if (rmaItem.status !== 'process') {
            throw new Error('Can only complete RMA items in process status');
        }

        // 更新 inventory_rma 狀態
        const result = await client.query(`
            UPDATE inventory_rma 
            SET 
                status = 'complete',
                solution = $1,
                completed_at = CURRENT_TIMESTAMP,
                completed_by = $2
            WHERE id = $3
            RETURNING *
        `, [solution, req.user.id, id]);

        // 更新 store_rma 狀態
        if (rmaItem.store_rma_id) {
            await client.query(`
                UPDATE store_rma
                SET 
                    inventory_status = 'complete'::rma_inventory_status,
                    store_status = 'completed'::rma_store_status,
                    solution = $1,
                    completed_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [solution, rmaItem.store_rma_id]);
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            item: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error completing RMA item:', {
            error: error.message,
            id: req.params.id,
            user: req.user.id,
            timestamp: new Date().toISOString()
        });
        res.status(400).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
};

// 標記 RMA 記錄為失敗
const failRmaItem = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            throw new Error('Failure reason is required');
        }

        await client.query('BEGIN');

        // 檢查記錄是否存在
        const checkResult = await client.query(`
            SELECT ir.*, sr.id as store_rma_id
            FROM (
                SELECT * FROM inventory_rma WHERE id = $1 FOR UPDATE
            ) ir
            LEFT JOIN store_rma sr ON ir.store_rma_id = sr.id
            WHERE ir.id = $1
        `, [id]);

        if (checkResult.rows.length === 0) {
            throw new Error('RMA record not found');
        }

        const rmaItem = checkResult.rows[0];
        if (!['receive', 'process'].includes(rmaItem.status)) {
            throw new Error('Can only fail RMA items in receive or process status');
        }

        // 更新 inventory_rma 狀態
        const result = await client.query(`
            UPDATE inventory_rma 
            SET 
                status = 'failed',
                failed_reason = $1,
                failed_at = CURRENT_TIMESTAMP,
                failed_by = $2
            WHERE id = $3
            RETURNING *
        `, [reason, req.user.id, id]);

        // 更新 store_rma 狀態
        if (rmaItem.store_rma_id) {
            await client.query(`
                UPDATE store_rma
                SET 
                    inventory_status = 'failed'::rma_inventory_status,
                    store_status = 'failed'::rma_store_status,
                    failed_reason = $1,
                    failed_at = CURRENT_TIMESTAMP
                WHERE id = $2
            `, [reason, rmaItem.store_rma_id]);
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            item: result.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error failing RMA item:', {
            error: error.message,
            id: req.params.id,
            user: req.user.id,
            timestamp: new Date().toISOString()
        });
        res.status(400).json({
            success: false,
            error: error.message
        });
    } finally {
        client.release();
    }
};

module.exports = {
    getRmaItems,
    searchRmaItems,
    createRmaItem,
    updateRmaItem,
    deleteRmaItem,
    getRmaItemById,
    processRmaItem,
    completeRmaItem,
    failRmaItem
}; 