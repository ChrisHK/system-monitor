const NodeCache = require('node-cache');

const cache = new NodeCache({
    stdTTL: 900, // 15 minutes
    checkperiod: 120, // Check for expired keys every 2 minutes
    useClones: false // Store/retrieve references to objects instead of copies
});

cache.on('expired', (key, value) => {
    console.log('Cache key expired:', key);
});

module.exports = cache; 