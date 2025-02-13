exports.up = async function(knex) {
    await knex.schema.alterTable('purchase_order_items', table => {
        // Add category_id column with foreign key reference
        table.integer('category_id').references('id').inTable('tag_categories');
    });
};

exports.down = async function(knex) {
    await knex.schema.alterTable('purchase_order_items', table => {
        table.dropColumn('category_id');
    });
}; 