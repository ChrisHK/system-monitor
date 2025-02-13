const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');
const os = require('os');

// 配置路徑
const SOURCE_FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const SOURCE_BACKEND_DIR = path.join(__dirname, '..', 'backend');
const FRONTEND_V20_DIR = path.join(__dirname, 'frontend-v20');
const BACKEND_V20_DIR = path.join(__dirname, 'backend-v20');
const WEBSITE_DIR = path.join(__dirname, 'website');
const BUILD_DIR = path.join(FRONTEND_V20_DIR, 'build');

// 配置常量
const PRODUCTION_DOMAIN = 'erp.zerounique.com';
const PRODUCTION_API_URL = `https://${PRODUCTION_DOMAIN}/api`;
const PRODUCTION_WS_URL = `wss://${PRODUCTION_DOMAIN}/ws`;

// 日誌函數
const log = {
    info: (msg) => console.log(chalk.blue(`[INFO] ${msg}`)),
    success: (msg) => console.log(chalk.green(`[SUCCESS] ${msg}`)),
    error: (msg) => console.log(chalk.red(`[ERROR] ${msg}`)),
    warning: (msg) => console.log(chalk.yellow(`[WARNING] ${msg}`))
};

// 檢查是否為Windows系統
const isWindows = os.platform() === 'win32';

// 轉換 package.json 中的依賴版本
function convertDependencies(dependencies) {
    const v20Compatible = {
        // 更新核心依賴的版本
        "express": "^4.18.2",
        "cors": "^2.8.5",
        "dotenv": "^16.0.3",
        "cookie-parser": "^1.4.6",
        "jsonwebtoken": "^9.0.0",
        "ws": "^8.12.0",
        "pg": "^8.8.0",
        "knex": "^2.4.2",
        // React 相關依賴
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "react-router-dom": "^6.6.2",
        "react-scripts": "5.0.1",
        // UI 庫
        "antd": "^5.1.2",
        "@ant-design/icons": "^5.0.1",
        "@mui/material": "^5.11.0",
        "@mui/icons-material": "^5.11.0",
        // 其他常用依賴
        "axios": "^1.2.2",
        "moment": "^2.29.4",
        "styled-components": "^5.3.6"
    };

    const result = {};
    for (const [key, version] of Object.entries(dependencies)) {
        result[key] = v20Compatible[key] || version;
    }
    return result;
}

// 應用自定義修改
async function applyCustomModifications() {
    // 1. 更新 .htaccess
    const htaccessContent = `# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN
PassengerAppRoot "/home/zerouniq/erp.zerounique.com"
PassengerBaseURI "/"
PassengerNodejs "/home/zerouniq/nodevenv/erp.zerounique.com/20/bin/node"
PassengerAppType node
PassengerStartupFile src/app.js
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END

# Redirect all HTTP traffic to HTTPS
RewriteEngine On
RewriteCond %{HTTPS} !=on
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301,NE]

# Set security headers
Header set X-Content-Type-Options "nosniff"
Header set X-XSS-Protection "1; mode=block"
Header set X-Frame-Options "SAMEORIGIN"
Header set Strict-Transport-Security "max-age=31536000; includeSubDomains"
Header set Content-Security-Policy "default-src 'self' https://erp.zerounique.com wss://erp.zerounique.com; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"

# Set correct content types
AddType application/javascript .js
AddType text/css .css
AddType image/x-icon .ico
AddType image/png .png
AddType image/jpeg .jpg .jpeg
AddType image/svg+xml .svg

# Handle API and WebSocket requests with Passenger
<LocationMatch "^/(api|ws)/">
    PassengerEnabled on
</LocationMatch>

# Handle client-side routing (skip if path starts with /api or /ws)
RewriteCond %{REQUEST_URI} !^/(api|ws)/
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [QSA,L]

# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Set caching
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType application/x-javascript "access plus 1 month"
    ExpiresByType image/x-icon "access plus 1 year"
    ExpiresDefault "access plus 2 days"
</IfModule>`;

    await fs.writeFile(path.join(FRONTEND_V20_DIR, 'public', '.htaccess'), htaccessContent);

    // 2. 更新 API 配置
    // 移除重複的 getApiBaseUrl 函數
    // const endpointsContent = `...`;
    // await fs.writeFile(...);

    // 3. 更新 package.json
    // ... existing code ...
}

async function deploy() {
    try {
        // 1. 檢查構建文件是否存在
        log.info('Checking build files...');
        const buildDir = path.join(FRONTEND_V20_DIR, 'build');
        if (!fs.existsSync(buildDir)) {
            throw new Error('Build directory not found! Please run npm run build in frontend-v20 first.');
        }

        // 2. 準備目標目錄
        log.info('Preparing target directories...');
        await fs.emptyDir(WEBSITE_DIR);

        // 3. 創建必要的目錄
        log.info('Creating necessary directories...');
        await fs.ensureDir(path.join(WEBSITE_DIR, 'public'));
        await fs.ensureDir(path.join(WEBSITE_DIR, 'src'));
        await fs.ensureDir(path.join(WEBSITE_DIR, 'logs'));
        await fs.ensureDir(path.join(WEBSITE_DIR, 'tmp'));

        // 4. 複製前端構建文件
        log.info('Copying frontend build files...');
        await fs.copy(buildDir, path.join(WEBSITE_DIR, 'public'));
        
        // 5. 複製後端文件
        log.info('Copying backend files...');
        await fs.copy(path.join(BACKEND_V20_DIR, 'src'), path.join(WEBSITE_DIR, 'src'));

        // 6. 創建生產環境配置
        log.info('Creating production environment configuration...');
        const prodEnv = `# Production Environment Configuration
NODE_ENV=production
API_URL=${PRODUCTION_API_URL}
WS_URL=${PRODUCTION_WS_URL}
PORT=80
HOST=${PRODUCTION_DOMAIN}
SSL_ENABLED=true

# JWT Configuration
JWT_SECRET=zerounique_erp_jwt_secret_2024_production

# Database Configuration
DB_USER=zerouniq_admin
DB_HOST=127.0.0.200
DB_NAME=zerouniq_db
DB_PASSWORD=is-Admin
DB_PORT=5432

# CORS Configuration
CORS_ORIGIN=https://${PRODUCTION_DOMAIN},http://${PRODUCTION_DOMAIN},https://api.${PRODUCTION_DOMAIN}

# WebSocket Configuration
WS_PATH=/ws
WS_PING_INTERVAL=30000

# Passenger Configuration
PASSENGER_APP_ENV=production
PASSENGER_APP_ROOT=/home/zerouniq/erp.zerounique.com
PUBLIC_URL=https://${PRODUCTION_DOMAIN}`;

        await fs.writeFile(path.join(WEBSITE_DIR, '.env'), prodEnv);

        // 7. 創建生產環境 package.json
        log.info('Creating production package.json...');
        const prodPackageJson = {
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
            JSON.stringify(prodPackageJson, null, 2)
        );

        // 8. 安裝生產環境依賴
        log.info('Installing production dependencies...');
        execSync('npm install', { cwd: WEBSITE_DIR, stdio: 'inherit' });

        // 9. 設置文件權限
        if (!isWindows) {
            log.info('Setting file permissions...');
            execSync(`chmod -R 755 ${WEBSITE_DIR}`, { stdio: 'inherit' });
            execSync(`find ${WEBSITE_DIR} -type f -exec chmod 644 {} \\;`, { stdio: 'inherit' });
            execSync(`chmod 755 ${path.join(WEBSITE_DIR, 'tmp')}`, { stdio: 'inherit' });
            execSync(`chmod 755 ${path.join(WEBSITE_DIR, 'logs')}`, { stdio: 'inherit' });
        }

        log.success('Deployment completed successfully!');
        
        // 10. 輸出提醒事項
        log.info('\nReminders:');
        log.info(`1. Upload all files to: /home/zerouniq/erp.zerounique.com/`);
        log.info('2. Verify file permissions:');
        log.info('   chmod -R 755 /home/zerouniq/erp.zerounique.com');
        log.info('   find /home/zerouniq/erp.zerounique.com -type f -exec chmod 644 {} \\;');
        log.info('   chmod 755 /home/zerouniq/erp.zerounique.com/tmp');
        log.info('   chmod 755 /home/zerouniq/erp.zerounique.com/logs');
        log.info('3. Restart the application:');
        log.info('   touch /home/zerouniq/erp.zerounique.com/tmp/restart.txt');
        log.info('4. Check logs for errors:');
        log.info('   tail -f /home/zerouniq/erp.zerounique.com/logs/error.log');

    } catch (error) {
        log.error(`Deployment failed: ${error.message}`);
        process.exit(1);
    }
}

// 執行部署
deploy(); 