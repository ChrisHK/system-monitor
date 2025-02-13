cd frontend-v20
npm run build

cd ..
node deploy.js

   website/
   ├── public/           <- 來自 frontend-v20/build（前端構建文件）
   ├── src/             <- 來自 backend-v20/src（後端源代碼）
   ├── logs/            <- 日誌目錄
   ├── tmp/             <- 臨時文件目錄
   ├── .env             <- 生產環境配置
   └── package.json     <- 後端依賴配置