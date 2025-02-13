const NodeCache = require('node-cache');

const cache = new NodeCache({
    stdTTL: 900, // 15 minutes
    checkperiod: 120, // Check for expired keys every 2 minutes
    useClones: false // Store/retrieve references to objects instead of copies
});

cache.on('expired', (key, value) => {
    console.log('Cache key expired:', key);
});

const multiLevelCache = {
    get: async (key) => {
        const local = cache.get(key);
        if (local) return local;
        const redisVal = await redisClient.get(key);
        if (redisVal) cache.set(key, redisVal);
        return redisVal;
    },
    set: (key, val) => {
        cache.set(key, val);
        redisClient.setEx(key, 3600, val); // 1 hour expiration
    }
};

module.exports = cache; 