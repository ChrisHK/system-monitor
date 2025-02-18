exports.up = async function(knex) {
    // Add is_active column to tag_relations table
    await knex.schema.alterTable('tag_relations', table => {
        table.boolean('is_active').defaultTo(true);
    });

    // Update existing records to set is_active = true
    await knex('tag_relations').update({ is_active: true });
};

exports.down = async function(knex) {
    // Remove is_active column from tag_relations table
    await knex.schema.alterTable('tag_relations', table => {
        table.dropColumn('is_active');
    });
}; 