#!/bin/bash

# 顯示時間戳
echo "Starting build process at $(date)"

# 確保在根目錄
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 檢查環境文件
if [ ! -f .env ]; then
    echo "Error: .env file not found in root directory"
    exit 1
fi

# 創建臨時部署目錄
DEPLOY_DIR="deploy_$(date +%Y%m%d_%H%M%S)"
mkdir -p $DEPLOY_DIR

# 構建前端
echo "Building frontend..."
cd frontend
# 複製環境文件
cp ../.env .env.production.local
# 安裝依賴
npm install
# 構建
npm run build
# 檢查構建結果
if [ ! -d "build" ]; then
    echo "Error: Frontend build failed"
    exit 1
fi

# 回到根目錄
cd ..

# 準備部署文件
echo "Preparing deployment files..."
# 複製後端文件
cp -r backend/* $DEPLOY_DIR/
# 創建必要的目錄
mkdir -p $DEPLOY_DIR/public
mkdir -p $DEPLOY_DIR/logs
mkdir -p $DEPLOY_DIR/tmp
# 移動前端構建文件
cp -r frontend/build/* $DEPLOY_DIR/public/
# 複製環境文件
cp .env $DEPLOY_DIR/.env.production

# 創建壓縮包
echo "Creating deployment archive..."
tar -czf ${DEPLOY_DIR}.tar.gz $DEPLOY_DIR

# 清理臨時目錄
rm -rf $DEPLOY_DIR

echo "Build completed at $(date)"
echo "Deployment archive created: ${DEPLOY_DIR}.tar.gz"
echo ""
echo "To deploy to remote server, run:"
echo "scp ${DEPLOY_DIR}.tar.gz zerouniq@erp.zerounique.com:/home/zerouniq/"
echo "ssh zerouniq@erp.zerounique.com './deploy.sh ${DEPLOY_DIR}.tar.gz'" 