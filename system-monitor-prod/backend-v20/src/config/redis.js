const { createClient } = require('redis');

const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', err => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Redis Client Connected'));

// 自動重連機制
redisClient.on('end', () => {
    console.log('Redis connection ended. Attempting to reconnect...');
    setTimeout(async () => {
        try {
            await redisClient.connect();
        } catch (err) {
            console.error('Redis reconnection failed:', err);
        }
    }, 5000);
});

// 初始化連接
(async () => {
    try {
        await redisClient.connect();
    } catch (err) {
        console.error('Initial Redis connection failed:', err);
    }
})();

module.exports = redisClient; 