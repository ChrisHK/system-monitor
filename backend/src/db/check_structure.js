const { Pool } = require('pg');

const pool = new Pool({
    user: 'zero',
    host: '192.168.0.10',
    database: 'zerodb',
    password: 'zero',
    port: 5432,
});

async function checkStructure() {
    try {
        const client = await pool.connect();
        try {
            console.log('Checking system_records structure:');
            const structureQuery = `
                SELECT 
                    column_name,
                    data_type,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE table_name = 'system_records'
                ORDER BY ordinal_position;
            `;
            const result = await client.query(structureQuery);
            console.log('\nColumns:');
            result.rows.forEach(col => {
                console.log(`${col.column_name}:`, {
                    type: col.data_type,
                    nullable: col.is_nullable,
                    default: col.column_default
                });
            });

            // Check for any NULL values in integer columns
            console.log('\nChecking for NULL values in integer columns:');
            const integerColumns = result.rows
                .filter(col => col.data_type === 'integer')
                .map(col => col.column_name);

            for (const column of integerColumns) {
                const nullCheck = `
                    SELECT COUNT(*) as null_count
                    FROM system_records
                    WHERE ${column} IS NULL;
                `;
                const nullResult = await client.query(nullCheck);
                console.log(`${column}:`, nullResult.rows[0].null_count, 'NULL values');
            }

        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error checking structure:', error);
    } finally {
        await pool.end();
    }
}

checkStructure(); 