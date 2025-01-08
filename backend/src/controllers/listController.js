const pool = require('../config/database');

exports.createList = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'List name is required' });
        }

        const result = await pool.query(
            'INSERT INTO custom_lists (name) VALUES ($1) RETURNING *',
            [name]
        );

        res.json({ success: true, list: result.rows[0] });
    } catch (error) {
        console.error('Error creating list:', error);
        res.status(500).json({ success: false, message: 'Failed to create list' });
    }
};

exports.addItemToList = async (req, res) => {
    try {
        const { listId } = req.params;
        const { serialNumber } = req.body;

        await pool.query(
            'INSERT INTO list_items (list_id, record_id) VALUES ($1, (SELECT id FROM system_records WHERE serialnumber = $2))',
            [listId, serialNumber]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error adding item to list:', error);
        res.status(500).json({ success: false, message: 'Failed to add item to list' });
    }
}; 