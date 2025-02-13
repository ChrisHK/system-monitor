const pool = require('../config/database');

// Get records with pagination
exports.getRecords = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        console.log(`Getting records for page ${page}`);
        
        const limit = 50;
        const offset = (page - 1) * limit;

        const client = await pool.connect();
        try {
            // 獲取總記錄數
            const countResult = await client.query('SELECT COUNT(*) FROM system_records');
            const totalRecords = parseInt(countResult.rows[0].count);
            const totalPages = Math.ceil(totalRecords / limit);

            // 獲取分頁數據
            const cursor = Buffer.from(lastRecordDate + '|' + lastId).toString('base64');
            const result = await client.query(`
                SELECT * FROM system_records 
                WHERE created_at > $1 OR (created_at = $1 AND id > $2)
                ORDER BY created_at, id
                LIMIT $3
            `, [lastRecordDate, lastId, limit]);

            console.log(`Found ${result.rows.length} records`);

            res.json({
                records: result.rows.map(record => ({
                    ...record,
                    created_at: record.formatted_date
                })),
                currentPage: page,
                totalPages: totalPages,
                totalRecords: totalRecords
            });
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('Error fetching records:', err);
        res.status(500).json({ 
            error: 'Failed to fetch records',
            message: err.message,
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
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
                    TO_CHAR(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD HH24:MI:SS') as formatted_date 
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
            TO_CHAR((created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') + INTERVAL '5 hours', 'YYYY-MM-DD HH24:MI:SS') as formatted_date
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
    try {
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
            GROUP BY serialnumber
            HAVING COUNT(*) > 1
            ORDER BY count DESC, serialnumber
        `;

        const result = await pool.query(query);
        
        res.json({
            success: true,
            duplicates: result.rows
        });
    } catch (error) {
        console.error('Error fetching duplicate serials:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch duplicate serials'
        });
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