const pool = require('../config/database');

// Add item to outbound
exports.addToOutbound = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { recordId } = req.body;
        
        // Check if record exists and is available
        const recordCheck = await client.query(
            'SELECT id, outbound_status FROM system_records WHERE id = $1',
            [recordId]
        );
        
        if (recordCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        if (recordCheck.rows[0].outbound_status !== 'available') {
            return res.status(400).json({ error: 'Record is not available for outbound' });
        }
        
        // Create or get pending outbound record
        let outboundRecord = await client.query(
            'SELECT id FROM outbound_records WHERE status = $1 LIMIT 1',
            ['pending']
        );
        
        let outboundId;
        if (outboundRecord.rows.length === 0) {
            const newOutbound = await client.query(
                'INSERT INTO outbound_records (status) VALUES ($1) RETURNING id',
                ['pending']
            );
            outboundId = newOutbound.rows[0].id;
        } else {
            outboundId = outboundRecord.rows[0].id;
        }
        
        // Add item to outbound
        await client.query(
            'INSERT INTO outbound_items (outbound_id, record_id) VALUES ($1, $2)',
            [outboundId, recordId]
        );
        
        // Update record status
        await client.query(
            'UPDATE system_records SET outbound_status = $1, outbound_id = $2 WHERE id = $3',
            ['pending', outboundId, recordId]
        );
        
        await client.query('COMMIT');
        
        res.json({ success: true, outboundId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error adding to outbound:', err);
        res.status(500).json({ error: 'Failed to add item to outbound' });
    } finally {
        client.release();
    }
};

// Remove item from outbound
exports.removeFromOutbound = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { recordId } = req.params;
        
        // Remove from outbound_items
        await client.query(
            'DELETE FROM outbound_items WHERE record_id = $1',
            [recordId]
        );
        
        // Reset record status
        await client.query(
            'UPDATE system_records SET outbound_status = $1, outbound_id = NULL WHERE id = $2',
            ['available', recordId]
        );
        
        await client.query('COMMIT');
        
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error removing from outbound:', err);
        res.status(500).json({ error: 'Failed to remove item from outbound' });
    } finally {
        client.release();
    }
};

// Get current outbound items
exports.getOutboundItems = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                oi.id as outbound_item_id,
                sr.*,
                or.status as outbound_status,
                TO_CHAR(oi.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD HH24:MI:SS') as added_at
            FROM outbound_items oi
            JOIN system_records sr ON oi.record_id = sr.id
            JOIN outbound_records or ON oi.outbound_id = or.id
            WHERE or.status = 'pending'
            ORDER BY oi.created_at DESC
        `);
        
        res.json({
            success: true,
            items: result.rows
        });
    } catch (err) {
        console.error('Error fetching outbound items:', err);
        res.status(500).json({ error: 'Failed to fetch outbound items' });
    }
};

// Confirm outbound
exports.confirmOutbound = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const { outboundId } = req.params;
        const { notes } = req.body;
        
        // Update outbound record status
        await client.query(
            'UPDATE outbound_records SET status = $1, notes = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            ['completed', notes, outboundId]
        );
        
        // Update all associated records
        await client.query(
            'UPDATE system_records SET outbound_status = $1 WHERE outbound_id = $2',
            ['completed', outboundId]
        );
        
        await client.query('COMMIT');
        
        res.json({ success: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error confirming outbound:', err);
        res.status(500).json({ error: 'Failed to confirm outbound' });
    } finally {
        client.release();
    }
}; 