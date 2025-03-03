exports.up = async function(knex) {
    await knex.schema.alterTable('purchase_order_items', table => {
        table.dropColumn('serial_number');
        table.string('serialnumber', 200).notNullable();
    });
};

exports.down = async function(knex) {
    await knex.schema.alterTable('purchase_order_items', table => {
        table.dropColumn('serialnumber');
        table.string('serial_number', 200).notNullable();
    });
}; 