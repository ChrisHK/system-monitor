class QueryBuilder {
    constructor() {
        this.params = [];
        this.paramIndex = 1;
        this.conditions = [];
        this.baseQuery = '';
    }

    // 添加基礎查詢
    setBaseQuery(query) {
        this.baseQuery = query;
        return this;
    }

    // 添加條件
    addCondition(condition, ...values) {
        const paramPlaceholders = values.map(() => `$${this.paramIndex++}`).join(', ');
        this.conditions.push(condition.replace('?', paramPlaceholders));
        this.params.push(...values);
        return this;
    }

    // 添加可選條件
    addOptionalCondition(shouldAdd, condition, ...values) {
        if (shouldAdd) {
            this.addCondition(condition, ...values);
        }
        return this;
    }

    // 構建最終查詢
    build() {
        const whereClause = this.conditions.length > 0 
            ? `WHERE ${this.conditions.join(' AND ')}` 
            : '';
        
        return {
            text: `${this.baseQuery} ${whereClause}`,
            values: this.params
        };
    }
}

// 常用查詢模板
const queryTemplates = {
    // 系統記錄相關查詢
    systemRecords: {
        base: `
            SELECT 
                r.*,
                COALESCE(s.id, si_all.store_id) as store_id,
                COALESCE(s.name, si_all.store_name) as store_name,
                COALESCE(il.location, 'inventory') as current_location,
                TO_CHAR(r.created_at, 'YYYY-MM-DD HH24:MI:SS') as formatted_date
            FROM system_records r
            LEFT JOIN store_items si ON r.id = si.record_id
            LEFT JOIN stores s ON si.store_id = s.id
            LEFT JOIN item_locations il ON r.serialnumber = il.serialnumber
            LEFT JOIN (
                SELECT record_id, store_id, s.name as store_name
                FROM store_items si_sub
                JOIN stores s ON si_sub.store_id = s.id
            ) si_all ON r.id = si_all.record_id
            WHERE r.is_current = true
        `,
        count: `
            SELECT COUNT(DISTINCT r.id) 
            FROM system_records r
            LEFT JOIN store_items si ON r.id = si.record_id
            LEFT JOIN stores s ON si.store_id = s.id
            WHERE r.is_current = true
        `,
        searchFields: ['r.serialnumber', 'r.model', 'r.manufacturer']
    },

    // 重複記錄查詢
    duplicates: `
        WITH record_counts AS (
            SELECT 
                serialnumber,
                COUNT(*) as record_count,
                MIN(created_at) as first_seen,
                MAX(created_at) as last_seen
            FROM system_records
            WHERE is_current = true
            GROUP BY serialnumber
            HAVING COUNT(*) > 1
        )
        SELECT 
            r.*,
            rc.record_count,
            rc.first_seen,
            rc.last_seen,
            TO_CHAR(r.created_at, 'YYYY-MM-DD HH24:MI:SS') as formatted_date
        FROM record_counts rc
        JOIN system_records r ON r.serialnumber = rc.serialnumber
        WHERE r.is_current = true
        ORDER BY rc.record_count DESC, r.serialnumber, r.created_at DESC
    `
};

// 數據庫事務輔助函數
const withTransaction = async (client, callback) => {
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    QueryBuilder,
    queryTemplates,
    withTransaction
}; 