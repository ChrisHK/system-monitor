const pool = require('../config/database');

// Get records with pagination
exports.getRecords = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        console.log('Executing query:', {
            query: `
            SELECT 
                r.*,
                TO_CHAR(r.created_at, 'YYYY-MM-DD HH24:MI:SS') as formatted_date
            FROM system_records r
            WHERE r.is_current = true
            ORDER BY r.created_at DESC, r.id DESC
            LIMIT $1 OFFSET $2
        `,
            params: [limit, offset]
        });

        const result = await pool.query(`
            SELECT 
                r.*,
                TO_CHAR(r.created_at, 'YYYY-MM-DD HH24:MI:SS') as formatted_date
            FROM system_records r
            WHERE r.is_current = true
            ORDER BY r.created_at DESC, r.id DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        // Get total count
        const countResult = await pool.query(
            'SELECT COUNT(*) FROM system_records WHERE is_current = true'
        );

        const records = result.rows.map(record => ({
            ...record,
            created_at: record.formatted_date
        }));

        res.json({
            records,
            totalRecords: parseInt(countResult.rows[0].count),
            totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
        });
    } catch (err) {
        console.error('Error fetching records:', err);
        res.status(500).json({ error: 'Failed to fetch records' });
    }
};

// Search records
exports.searchRecords = async (req, res) => {
    try {
        const { field, term } = req.query;
        console.log('Search params:', { field, term });

        if (!term || !field) {
            return res.status(400).json({ 
                error: 'Search term and field are required',
                records: [],
                totalRecords: 0,
                totalPages: 0
            });
        }

        // 驗證搜索欄位
        const validFields = ['serialnumber', 'computername', 'manufacturer', 'model', 'systemsku'];
        if (!validFields.includes(field)) {
            return res.status(400).json({
                error: 'Invalid search field',
                records: [],
                totalRecords: 0,
                totalPages: 0
            });
        }

        const query = {
            text: `
                SELECT 
                    *,
                    TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as formatted_date 
                FROM system_records 
                WHERE LOWER(${field}::text) LIKE LOWER($1)
                ORDER BY created_at DESC
            `,
            values: [`%${term}%`]
        };

        const result = await pool.query(query);
        const records = result.rows.map(record => ({
            ...record,
            created_at: record.formatted_date
        }));

        const response = {
            records,
            totalRecords: records.length,
            totalPages: Math.ceil(records.length / 50)
        };

        res.json(response);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ 
            error: 'Search failed: ' + err.message,
            records: [],
            totalRecords: 0,
            totalPages: 0
        });
    }
};

// Search by serial number
exports.searchBySerialNumber = async (req, res) => {
    try {
        const { serialnumber } = req.params;
        
        const result = await pool.query(`
            SELECT *,
            TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as formatted_date
            FROM system_records 
            WHERE serialnumber = $1
            ORDER BY created_at DESC 
            LIMIT 1
        `, [serialnumber]);
        
        if (result.rows.length > 0) {
            const record = {
                ...result.rows[0],
                created_at: result.rows[0].formatted_date
            };
            res.json({ success: true, record });
        } else {
            res.json({ success: false, message: 'Serial number not found' });
        }
    } catch (error) {
        console.error('Error searching by SN:', error);
        res.status(500).json({ success: false, message: 'Search failed' });
    }
};

// Get duplicate serials
exports.getDuplicateSerials = async (req, res) => {
    const client = await pool.connect();
    try {
        // 1. 查找重複記錄
        const query = `
            SELECT serialnumber, COUNT(*) as count, 
                   array_agg(json_build_object(
                       'id', id,
                       'serialnumber', serialnumber,
                       'computername', computername,
                       'manufacturer', manufacturer,
                       'model', model,
                       'created_at', created_at
                   ) ORDER BY created_at DESC) as records
            FROM system_records
            WHERE serialnumber IS NOT NULL
            AND is_current = true
            GROUP BY serialnumber
            HAVING COUNT(*) > 1
            ORDER BY count DESC, serialnumber
        `;

        const result = await client.query(query);
        
        // 2. 如果發現重複記錄，自動執行清理
        if (result.rows.length > 0) {
            console.log(`Found ${result.rows.length} duplicate serial numbers, starting cleanup...`);
            
            await client.query('BEGIN');

            // 3. 找出每個序列號最新的記錄並更新其他記錄
            const updateResult = await client.query(`
                WITH latest_records AS (
                    SELECT id, serialnumber,
                        ROW_NUMBER() OVER (PARTITION BY serialnumber ORDER BY created_at DESC) as rn
                    FROM system_records
                    WHERE is_current = true
                    AND serialnumber IN (
                        SELECT serialnumber
                        FROM system_records
                        WHERE is_current = true
                        GROUP BY serialnumber
                        HAVING COUNT(*) > 1
                    )
                )
                UPDATE system_records
                SET is_current = false
                WHERE id NOT IN (
                    SELECT id 
                    FROM latest_records 
                    WHERE rn = 1
                )
                AND is_current = true
                AND serialnumber IN (
                    SELECT serialnumber
                    FROM latest_records
                )
                RETURNING id
            `);

            await client.query('COMMIT');

            // 4. 返回清理結果
            res.json({
                success: true,
                duplicates: result.rows,
                cleanup: {
                    performed: true,
                    recordsUpdated: updateResult.rowCount,
                    timestamp: new Date().toISOString()
                }
            });
        } else {
            res.json({
                success: true,
                duplicates: [],
                cleanup: {
                    performed: false,
                    message: 'No duplicates found'
                }
            });
        }
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error fetching duplicate serials:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch duplicate serials',
            details: error.message
        });
    } finally {
        client.release();
    }
};

exports.deleteRecord = async (req, res) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;

        await client.query('BEGIN');

        // First check if this record exists
        const checkResult = await client.query(
            'SELECT serialnumber FROM system_records WHERE id = $1',
            [id]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Record not found'
            });
        }

        // Check if this is not the last record with this serial number
        const serialNumber = checkResult.rows[0].serialnumber;
        const countResult = await client.query(
            'SELECT COUNT(*) FROM system_records WHERE serialnumber = $1',
            [serialNumber]
        );

        if (parseInt(countResult.rows[0].count) <= 1) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete the only record with this serial number'
            });
        }

        // Perform the deletion
        await client.query(
            'DELETE FROM system_records WHERE id = $1',
            [id]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Record deleted successfully'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting record:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete record'
        });
    } finally {
        client.release();
    }
};

// ... 其他控制器方法 