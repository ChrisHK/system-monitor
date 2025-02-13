const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

// 配置路徑
const SOURCE_DIR = path.join(__dirname, 'backend-v20', 'src');
const TARGET_DIR = path.join(__dirname, 'website', 'src');

// 日誌函數
const log = {
    info: (msg) => console.log(chalk.blue(`[INFO] ${msg}`)),
    success: (msg) => console.log(chalk.green(`[SUCCESS] ${msg}`)),
    error: (msg) => console.log(chalk.red(`[ERROR] ${msg}`)),
    warning: (msg) => console.log(chalk.yellow(`[WARNING] ${msg}`))
};

// 需要保留的文件（不覆蓋）
const preserveFiles = [
    'config/database.js',
    'config/logger.js',
    '.env'
];

// 需要忽略的目錄和文件
const ignorePatterns = [
    'node_modules',
    'logs',
    'tmp',
    '.git',
    'test',
    '.env.local',
    '.env.development',
    'package-lock.json',
    'yarn.lock'
];

// 檢查文件是否應該被忽略
function shouldIgnore(file) {
    return ignorePatterns.some(pattern => file.includes(pattern));
}

// 檢查文件是否應該被保留（不覆蓋）
function shouldPreserve(file) {
    return preserveFiles.some(pattern => file.endsWith(pattern));
}

// 複製文件
async function copyFiles(source, target) {
    try {
        // 確保目標目錄存在
        await fs.ensureDir(target);

        // 讀取源目錄
        const items = await fs.readdir(source);

        for (const item of items) {
            const sourcePath = path.join(source, item);
            const targetPath = path.join(target, item);

            // 檢查是否應該忽略
            if (shouldIgnore(sourcePath)) {
                log.info(`Skipping ignored path: ${sourcePath}`);
                continue;
            }

            // 獲取文件狀態
            const stats = await fs.stat(sourcePath);

            if (stats.isDirectory()) {
                // 遞歸複製目錄
                await copyFiles(sourcePath, targetPath);
            } else {
                // 檢查是否應該保留原文件
                if (shouldPreserve(sourcePath)) {
                    log.info(`Preserving existing file: ${targetPath}`);
                    continue;
                }

                // 複製文件
                await fs.copy(sourcePath, targetPath, { overwrite: true });
                log.success(`Copied: ${sourcePath} -> ${targetPath}`);
            }
        }
    } catch (error) {
        log.error(`Error copying files: ${error.message}`);
        throw error;
    }
}

// 更新數據庫配置
async function updateDatabaseConfig() {
    const dbConfigPath = path.join(TARGET_DIR, 'db', 'index.js');
    if (await fs.pathExists(dbConfigPath)) {
        try {
            let content = await fs.readFile(dbConfigPath, 'utf8');
            
            // 更新數據庫配置
            content = content.replace(
                /host: .*,/g,
                `host: process.env.DB_HOST || '127.0.0.200',`
            );
            content = content.replace(
                /database: .*,/g,
                `database: process.env.DB_NAME || 'zerouniq_db',`
            );
            content = content.replace(
                /user: .*,/g,
                `user: process.env.DB_USER || 'zerouniq_admin',`
            );
            content = content.replace(
                /password: .*,/g,
                `password: process.env.DB_PASSWORD || 'is-Admin',`
            );

            await fs.writeFile(dbConfigPath, content, 'utf8');
            log.success('Updated database configuration');
        } catch (error) {
            log.error(`Error updating database configuration: ${error.message}`);
        }
    }
}

async function main() {
    try {
        log.info('Starting backend file copy process...');

        // 1. 檢查源目錄是否存在
        if (!fs.existsSync(SOURCE_DIR)) {
            throw new Error('Source directory not found!');
        }

        // 2. 確保目標目錄存在
        await fs.ensureDir(TARGET_DIR);

        // 3. 複製文件
        log.info('Copying backend files...');
        await copyFiles(SOURCE_DIR, TARGET_DIR);

        // 4. 更新數據庫配置
        log.info('Updating database configuration...');
        await updateDatabaseConfig();

        log.success('Backend file copy process completed successfully!');
        
        // 5. 輸出提醒事項
        log.info('\nNext steps:');
        log.info('1. Review the copied files in website/src/');
        log.info('2. Verify database configuration in website/src/db/index.js');
        log.info('3. Check environment variables in .env file');
        log.info('4. Restart the application if necessary');

    } catch (error) {
        log.error(`Process failed: ${error.message}`);
        process.exit(1);
    }
}

// 執行主程序
main(); 