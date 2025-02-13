const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

// 配置路徑
const SOURCE_DIR = path.join(__dirname, '..', 'frontend');
const TARGET_DIR = path.join(__dirname, 'frontend-v20');

// 日誌函數
const log = {
    info: (msg) => console.log(chalk.blue(`[INFO] ${msg}`)),
    success: (msg) => console.log(chalk.green(`[SUCCESS] ${msg}`)),
    error: (msg) => console.log(chalk.red(`[ERROR] ${msg}`)),
    warning: (msg) => console.log(chalk.yellow(`[WARNING] ${msg}`))
};

// 需要保留的文件（不覆蓋）
const preserveFiles = [
    'package.json',
    '.env',
    '.env.production',
    'public/.htaccess'
];

// 需要忽略的目錄和文件
const ignorePatterns = [
    'node_modules',
    'build',
    '.git',
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

// 更新源代碼中的版本相關引用
async function updateVersionReferences(directory) {
    try {
        const items = await fs.readdir(directory);

        for (const item of items) {
            const fullPath = path.join(directory, item);
            
            // 檢查是否應該忽略
            if (shouldIgnore(fullPath)) {
                continue;
            }

            const stats = await fs.stat(fullPath);

            if (stats.isDirectory()) {
                // 遞歸處理子目錄
                await updateVersionReferences(fullPath);
            } else if (fullPath.match(/\.(js|jsx|ts|tsx)$/)) {
                // 讀取文件內容
                let content = await fs.readFile(fullPath, 'utf8');

                // 更新 antd 版本相關的引用
                content = content.replace(/@ant-design\/icons@\^23/g, '@ant-design/icons@^5.0.1');
                content = content.replace(/antd@\^23/g, 'antd@^5.1.2');
                
                // 更新 MUI 版本相關的引用
                content = content.replace(/@mui\/material@\^23/g, '@mui/material@^5.11.0');
                content = content.replace(/@mui\/icons-material@\^23/g, '@mui/icons-material@^5.11.0');

                // 保存修改後的文件
                await fs.writeFile(fullPath, content, 'utf8');
                log.success(`Updated version references in: ${fullPath}`);
            }
        }
    } catch (error) {
        log.error(`Error updating version references: ${error.message}`);
        throw error;
    }
}

async function main() {
    try {
        log.info('Starting file copy process...');

        // 1. 檢查源目錄是否存在
        if (!fs.existsSync(SOURCE_DIR)) {
            throw new Error('Source directory not found!');
        }

        // 2. 確保目標目錄存在
        await fs.ensureDir(TARGET_DIR);

        // 3. 複製文件
        log.info('Copying files...');
        await copyFiles(SOURCE_DIR, TARGET_DIR);

        // 4. 更新版本引用
        log.info('Updating version references...');
        await updateVersionReferences(TARGET_DIR);

        log.success('File copy process completed successfully!');
        
        // 5. 輸出提醒事項
        log.info('\nNext steps:');
        log.info('1. Review the copied files in frontend-v20/');
        log.info('2. Run npm install in frontend-v20/');
        log.info('3. Test the build with npm run build');
        log.info('4. Run node deploy.js to deploy the changes');

    } catch (error) {
        log.error(`Process failed: ${error.message}`);
        process.exit(1);
    }
}

// 執行主程序
main(); 