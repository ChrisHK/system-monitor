const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            console.error('Authentication failed: No token provided');
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }

        // Check if it's a Bearer token
        if (!authHeader.startsWith('Bearer ')) {
            console.error('Authentication failed: Invalid token format');
            return res.status(401).json({
                success: false,
                error: 'Invalid token format'
            });
        }

        // Get the token part
        const token = authHeader.split(' ')[1];

        // Verify token with specific algorithm
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: [process.env.JWT_ALGORITHM || 'HS256']
        });
        
        // Add user info to request
        req.user = decoded;

        // Log successful verification
        console.log('Token verified successfully:', {
            userId: decoded.id,
            username: decoded.username,
            groupId: decoded.group_id,
            timestamp: new Date().toISOString()
        });

        next();
    } catch (error) {
        // Handle specific JWT errors
        if (error.name === 'TokenExpiredError') {
            console.error('Token expired:', {
                error: error.message,
                expiredAt: error.expiredAt
            });
            return res.status(401).json({
                success: false,
                error: 'Token has expired'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            console.error('Invalid token:', {
                error: error.message
            });
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }

        console.error('Token verification failed:', {
            error: error.message,
            name: error.name,
            timestamp: new Date().toISOString()
        });

        return res.status(401).json({
            success: false,
            error: 'Authentication failed'
        });
    }
};

module.exports = {
    verifyToken
}; 