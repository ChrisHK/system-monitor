const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'zero',
    host: process.env.DB_HOST || '192.168.0.10',
    database: process.env.DB_NAME || 'zerodev',
    password: process.env.DB_PASSWORD || 'zero',
    port: parseInt(process.env.DB_PORT || '5432'),
    // Add connection timeout and pool settings
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 20
});

// Add pool error handling
pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
});

// Add pool connection testing
const testConnection = async () => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        console.log('Database connection successful:', {
            timestamp: result.rows[0].now,
            database: pool.options.database,
            user: pool.options.user,
            host: pool.options.host
        });
        return true;
    } catch (err) {
        console.error('Database connection error:', {
            error: err.message,
            database: pool.options.database,
            user: pool.options.user,
            host: pool.options.host
        });
        return false;
    } finally {
        if (client) client.release();
    }
};

// Test connection on startup
testConnection();

async function checkListItems() {
    let client;
    try {
        client = await pool.connect();
        
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

        return {
            success: true,
            structure: structure.rows,
            count: count.rows[0].count,
            samples: count.rows[0].count > 0 ? samples.rows : []
        };
    } catch (error) {
        console.error('Error checking list_items:', error);
        throw new Error(`Failed to check list items: ${error.message}`);
    } finally {
        if (client) {
            try {
                await client.release();
            } catch (releaseError) {
                console.error('Error releasing client:', releaseError);
            }
        }
    }
}

// Export the function for use in other modules
module.exports = checkListItems;

// Only run directly if this is the main module
if (require.main === module) {
    checkListItems()
        .then(result => {
            console.log('Check completed successfully');
            process.exit(0);
        })
        .catch(error => {
            console.error('Check failed:', error);
            process.exit(1);
        });
} 