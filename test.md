cd frontend-v20
npm run build

cd ..
node deploy.js

   /home/zerouniq/erp.zerounique.com/
   ├── public/           <- 來自 frontend-v20/build（前端構建文件）
   ├── src/             <- 來自 backend-v20/src（後端源代碼）
   ├── logs/            <- 日誌目錄
   ├── tmp/             <- 臨時文件目錄
   ├── .env             <- 生產環境配置
   └── package.json     <- 後端依賴配置

   /home/zerouniq/erp.zerounique.com/
├── src/                # 源代碼目錄
├── config/            # 配置文件目錄
├── .env.production    # 生產環境配置
├── package.json       # 依賴配置
├── package-lock.json  # 依賴版本鎖定
└── node_modules/      # 依賴模塊（建議在服務器上重新安裝）

