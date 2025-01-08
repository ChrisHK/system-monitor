const { Pool } = require('pg');

const pool = new Pool({
    user: 'zero',
    host: '192.168.0.10',
    database: 'zerodb',
    password: 'zero',
    port: 5432,
});

async function checkListItems() {
    try {
        const client = await pool.connect();
        try {
            // Check list_items structure
            console.log('Checking list_items structure...');
            const structureQuery = `
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'list_items'
                ORDER BY ordinal_position;
            `;
            const structure = await client.query(structureQuery);
            console.log('\nlist_items columns:');
            console.log(structure.rows);

            // Check list_items data
            console.log('\nChecking list_items data...');
            const countQuery = `
                SELECT COUNT(*) as count
                FROM list_items
            `;
            const count = await client.query(countQuery);
            console.log('Number of list items:', count.rows[0].count);

            // Show sample data
            if (count.rows[0].count > 0) {
                const sampleQuery = `
                    SELECT li.*, r.serialnumber, r.computername
                    FROM list_items li
                    LEFT JOIN records r ON li.record_id = r.id
                    LIMIT 3
                `;
                const samples = await client.query(sampleQuery);
                console.log('\nSample list items with record info:');
                console.log(samples.rows);
            }

        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error checking list_items:', error);
    } finally {
        await pool.end();
    }
}

checkListItems(); 