exports.up = async function(knex) {
    // Create processing_logs table
    await knex.schema.createTable('processing_logs', table => {
        table.increments('id').primary();
        table.string('batch_id').notNullable();
        table.string('source').notNullable();
        table.string('status').notNullable();
        table.integer('total_items').notNullable();
        table.integer('processed_count').defaultTo(0);
        table.integer('error_count').defaultTo(0);
        table.jsonb('errors').defaultTo('[]');
        table.text('error_message');
        table.timestamp('started_at').notNullable();
        table.timestamp('completed_at');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        
        // Add indexes
        table.index('batch_id');
        table.index('status');
        table.index('started_at');
    });

    // Create processing_logs_archive table
    await knex.schema.createTable('processing_logs_archive', table => {
        table.increments('id').primary();
        table.integer('original_id').notNullable();
        table.string('batch_id').notNullable();
        table.string('source').notNullable();
        table.string('status').notNullable();
        table.integer('total_items').notNullable();
        table.integer('processed_count');
        table.integer('error_count');
        table.jsonb('errors');
        table.text('error_message');
        table.timestamp('started_at').notNullable();
        table.timestamp('completed_at');
        table.timestamp('created_at');
        table.timestamp('archived_at').notNullable();
        
        // Add indexes
        table.index('batch_id');
        table.index('archived_at');
    });
};

exports.down = async function(knex) {
    await knex.schema.dropTable('processing_logs_archive');
    await knex.schema.dropTable('processing_logs');
}; 