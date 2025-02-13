const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');
const os = require('os');

// 配置路徑
const FRONTEND_DIR = path.join(__dirname, 'frontend-v20');
const WEBSITE_DIR = path.join(__dirname, 'website');
const BUILD_DIR = path.join(FRONTEND_DIR, 'build');

// 日誌函數
const log = {
    info: (msg) => console.log(chalk.blue(`[INFO] ${msg}`)),
    success: (msg) => console.log(chalk.green(`[SUCCESS] ${msg}`)),
    error: (msg) => console.log(chalk.red(`[ERROR] ${msg}`)),
    warning: (msg) => console.log(chalk.yellow(`[WARNING] ${msg}`))
};

// 檢查是否為Windows系統
const isWindows = os.platform() === 'win32';

async function deploy() {
    try {
        // 1. 檢查必要目錄是否存在
        log.info('Checking directories...');
        if (!fs.existsSync(FRONTEND_DIR)) {
            throw new Error('Frontend directory not found!');
        }
        if (!fs.existsSync(WEBSITE_DIR)) {
            throw new Error('Website directory not found!');
        }

        // 2. 安裝前端依賴
        log.info('Installing frontend dependencies...');
        execSync('npm install', { cwd: FRONTEND_DIR, stdio: 'inherit' });

        // 3. 構建前端項目
        log.info('Building frontend project...');
        execSync('npm run build', { cwd: FRONTEND_DIR, stdio: 'inherit' });

        // 4. 清理website/public目錄
        log.info('Cleaning website/public directory...');
        await fs.emptyDir(path.join(WEBSITE_DIR, 'public'));

        // 5. 複製構建文件到website目錄
        log.info('Copying build files to website directory...');
        await fs.copy(BUILD_DIR, path.join(WEBSITE_DIR, 'public'));

        // 6. 複製或更新.htaccess文件
        const htaccessSource = path.join(__dirname, 'frontend-v20', 'public', '.htaccess');
        const htaccessDest = path.join(WEBSITE_DIR, '.htaccess');
        if (fs.existsSync(htaccessSource)) {
            await fs.copy(htaccessSource, htaccessDest, { overwrite: true });
            log.success('Updated .htaccess file');
        }

        // 7. 更新環境變數文件
        log.info('Updating environment variables...');
        const envContent = `# Production Environment Configuration
NODE_ENV=production
API_URL=https://erp.zerounique.com/api
WS_URL=wss://erp.zerounique.com/ws
PORT=80
HOST=erp.zerounique.com
SSL_ENABLED=true

# Passenger Configuration
PASSENGER_APP_ENV=production`;

        await fs.writeFile(path.join(WEBSITE_DIR, '.env'), envContent);

        // 8. 更新或創建package.json
        log.info('Updating package.json...');
        const packageJson = {
            name: "erp-zerounique",
            version: "1.0.0",
            private: true,
            scripts: {
                start: "node src/app.js"
            },
            dependencies: {
                "cookie-parser": "^1.4.6",
                "cors": "^2.8.5",
                "dotenv": "^16.0.3",
                "express": "^4.18.2",
                "express-validator": "^6.14.2",
                "jsonwebtoken": "^9.0.0",
                "knex": "^2.4.2",
                "morgan": "^1.10.0",
                "pg": "^8.8.0",
                "ws": "^8.12.0"
            }
        };

        await fs.writeFile(
            path.join(WEBSITE_DIR, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );

        // 9. 安裝後端依賴
        log.info('Installing backend dependencies...');
        execSync('npm install', { cwd: WEBSITE_DIR, stdio: 'inherit' });

        // 10. 設置文件權限 (僅在非Windows系統執行)
        if (!isWindows) {
            log.info('Setting file permissions...');
            execSync(`chmod -R 755 ${path.join(WEBSITE_DIR, 'public')}`, { stdio: 'inherit' });
            execSync(`find ${path.join(WEBSITE_DIR, 'public')} -type f -exec chmod 644 {} \\;`, { stdio: 'inherit' });
        }

        // 11. 處理警告和錯誤
        const warnings = [];
        
        // 檢查並添加缺失的開發依賴
        if (!fs.existsSync(path.join(FRONTEND_DIR, 'node_modules', '@babel', 'plugin-proposal-private-property-in-object'))) {
            warnings.push('Missing @babel/plugin-proposal-private-property-in-object dependency');
            log.warning('Installing missing babel plugin...');
            execSync('npm install --save-dev @babel/plugin-proposal-private-property-in-object', { 
                cwd: FRONTEND_DIR, 
                stdio: 'inherit' 
            });
        }

        log.success('Deployment completed successfully!');
        
        // 12. 輸出部署後的提醒事項
        log.info('\nReminders:');
        log.info('1. Make sure your web server is configured correctly');
        log.info('2. Verify SSL certificates are in place');
        log.info('3. Test the application at https://erp.zerounique.com');
        log.info('4. Check server logs for any errors');
        log.info('5. Restart the Node.js application if necessary');

        // 輸出警告信息
        if (warnings.length > 0) {
            log.warning('\nWarnings:');
            warnings.forEach(warning => log.warning(`- ${warning}`));
        }

        // 輸出ESLint警告處理建議
        log.info('\nTo address ESLint warnings:');
        log.info('1. Review the warnings in the build output');
        log.info('2. Fix the issues or add appropriate eslint-disable comments');
        log.info('3. Consider adding rules to .eslintrc to suppress false positives');

    } catch (error) {
        log.error(`Deployment failed: ${error.message}`);
        process.exit(1);
    }
}

// 執行部署
deploy(); 