exports.up = async function(knex) {
    // 檢查列是否已存在
    const hasColumn = await knex.schema.hasColumn('tag_categories', 'usage_flags');
    
    if (!hasColumn) {
        // 添加 usage_flags 列
        await knex.schema.alterTable('tag_categories', table => {
            table.jsonb('usage_flags').defaultTo('{}');
        });

        // 為現有記錄設置默認值
        await knex('tag_categories').update({
            usage_flags: '{}'
        });
    }
};

exports.down = async function(knex) {
    // 檢查列是否存在
    const hasColumn = await knex.schema.hasColumn('tag_categories', 'usage_flags');
    
    if (hasColumn) {
        // 刪除 usage_flags 列
        await knex.schema.alterTable('tag_categories', table => {
            table.dropColumn('usage_flags');
        });
    }
}; 