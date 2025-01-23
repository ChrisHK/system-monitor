const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    max: 20,                 // 最大連接數
    idleTimeoutMillis: 30000,// 空閒超時
    connectionTimeoutMillis: 2000
});

// 測試數據庫連接
pool.on('connect', () => {
    console.log('Database connected successfully');
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
});

// 導出數據庫連接池和方法
const db = {
    query: (text, params) => pool.query(text, params),
    connect: () => pool.connect(),
    pool: pool
};

module.exports = db; 