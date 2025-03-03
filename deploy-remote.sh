#!/bin/bash

# 配置
REMOTE_USER="zerouniq"
REMOTE_HOST="erp.zerounique.com"
REMOTE_PATH="/home/zerouniq"

# 顯示時間戳
echo "Starting remote deployment at $(date)"

# 運行本地構建
./build.sh
if [ $? -ne 0 ]; then
    echo "Build failed"
    exit 1
fi

# 獲取最新的部署包
DEPLOY_ARCHIVE=$(ls -t deploy_*.tar.gz | head -n1)
if [ -z "$DEPLOY_ARCHIVE" ]; then
    echo "No deployment archive found"
    exit 1
fi

# 上傳到遠端服務器
echo "Uploading deployment archive to remote server..."
scp ${DEPLOY_ARCHIVE} ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/

# 在遠端服務器執行部署
echo "Executing deployment on remote server..."
ssh ${REMOTE_USER}@${REMOTE_HOST} "cd ${REMOTE_PATH} && ./deploy.sh ${DEPLOY_ARCHIVE}"

# 清理本地文件
echo "Cleaning up local files..."
rm ${DEPLOY_ARCHIVE}

echo "Remote deployment completed at $(date)" 