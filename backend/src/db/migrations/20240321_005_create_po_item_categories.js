exports.up = async function(knex) {
    await knex.schema.createTable('po_item_categories', table => {
        table.increments('id').primary();
        table.integer('po_item_id').references('id').inTable('purchase_order_items').onDelete('CASCADE');
        table.integer('category_id').references('id').inTable('tag_categories');
        table.integer('tag_id').references('id').inTable('tags');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());

        // Add indexes
        table.index('po_item_id');
        table.index('category_id');
        table.index('tag_id');
    });
};

exports.down = async function(knex) {
    await knex.schema.dropTableIfExists('po_item_categories');
}; 