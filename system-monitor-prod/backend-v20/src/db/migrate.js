const path = require('path');
const fs = require('fs').promises;

async function runMigrations() {
    try {
        console.log('Starting database migrations...');
        
        // 獲取遷移腳本目錄
        const migrationsDir = path.join(__dirname, 'migrations');
        
        // 讀取所有 .js 文件
        const files = await fs.readdir(migrationsDir);
        const jsFiles = files.filter(file => file.endsWith('.js'));
        
        // 按文件名排序
        jsFiles.sort();
        
        // 執行每個遷移腳本
        for (const file of jsFiles) {
            console.log(`\nExecuting migration: ${file}`);
            const migrationPath = path.join(migrationsDir, file);
            require(migrationPath);
            
            // 等待一小段時間確保日誌順序正確
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('\nAll migrations completed');
        
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// 執行遷移
runMigrations(); 