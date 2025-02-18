const jwt = require('jsonwebtoken');
const { verifyToken } = require('../middleware/authMiddleware');

// Mock request and response
const mockReq = (token) => ({
    headers: {
        authorization: token ? `Bearer ${token}` : undefined
    }
});

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('Auth Middleware Tests', () => {
    const validToken = jwt.sign(
        { id: 1, username: 'test' },
        process.env.JWT_SECRET || 'test_secret',
        { expiresIn: '24h' }
    );

    test('Should pass with valid token', () => {
        const req = mockReq(validToken);
        const res = mockRes();
        const next = jest.fn();

        verifyToken(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(req.user).toBeDefined();
    });

    test('Should fail with invalid token', () => {
        const req = mockReq('invalid_token');
        const res = mockRes();
        const next = jest.fn();

        verifyToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            error: expect.any(String)
        }));
    });

    test('Should fail with missing token', () => {
        const req = mockReq();
        const res = mockRes();
        const next = jest.fn();

        verifyToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            error: 'No token provided'
        }));
    });
}); 