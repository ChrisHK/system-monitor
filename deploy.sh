#!/bin/bash

# 顯示時間戳
echo "Starting deployment at $(date)"

# 確保在根目錄
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 檢查環境文件
if [ ! -f .env ]; then
    echo "Error: .env file not found in root directory"
    exit 1
fi

# 構建前端
echo "Building frontend..."
cd frontend
# 複製根目錄的環境文件
cp ../.env .env.production.local
# 安裝依賴
npm install --production
# 構建
npm run build
# 檢查構建結果
if [ ! -d "build" ]; then
    echo "Error: Frontend build failed"
    exit 1
fi

# 移動到後端目錄
cd ../backend
# 複製根目錄的環境文件
cp ../.env .env.production
# 安裝依賴
npm install --production

# 創建必要的目錄
mkdir -p public
mkdir -p logs
mkdir -p tmp

# 移動前端構建文件到後端的 public 目錄
echo "Moving frontend build to backend public directory..."
rm -rf public/*
mv ../frontend/build/* public/

# 顯示完成信息
echo "Deployment completed at $(date)"
echo "Please restart the server to apply changes"

# 提示重啟服務器
echo "To restart the server, run:"
echo "pm2 restart system-monitor" 