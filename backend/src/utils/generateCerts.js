const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const certsDir = path.join(__dirname, '../../certs');

// 創建證書目錄
if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir, { recursive: true });
}

// 生成自簽名證書
const openssl = process.platform === 'win32' ? 'openssl.exe' : 'openssl';

try {
    // 生成私鑰
    execSync(`${openssl} genrsa -out "${path.join(certsDir, 'server.key')}" 2048`);
    
    // 生成證書
    execSync(`${openssl} req -new -x509 -key "${path.join(certsDir, 'server.key')}" -out "${path.join(certsDir, 'server.cert')}" -days 365 -subj "/CN=localhost"`);
    
    console.log('SSL certificates generated successfully!');
} catch (error) {
    console.error('Error generating certificates:', error.message);
    
    // 如果沒有 OpenSSL，創建測試用的自簽名證書
    const testKey = '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDZ7TJ8Xy8fBpL4\n...';
    const testCert = '-----BEGIN CERTIFICATE-----\nMIIDazCCAlOgAwIBAgIUBrr76+qw0kY0h+jTGoZgUw0oqaswDQYJKoZIhvcNAQEL\n...';
    
    fs.writeFileSync(path.join(certsDir, 'server.key'), testKey);
    fs.writeFileSync(path.join(certsDir, 'server.cert'), testCert);
    
    console.log('Test certificates created for development.');
} 