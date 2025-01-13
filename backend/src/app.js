require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const recordRoutes = require('./routes/recordRoutes');
const outboundRoutes = require('./routes/outboundRoutes');
const storeRoutes = require('./routes/storeRoutes');
const userRoutes = require('./routes/userRoutes');
const locationRoutes = require('./routes/locationRoutes');

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
    origin: [
        'http://localhost:4001',
        'http://192.168.0.10:4001'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// JWT Secret check
if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set in environment variables');
    process.exit(1);
}

// API Routes
app.use('/api/records', recordRoutes);
app.use('/api/outbound', outboundRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/locations', locationRoutes);

// Create WebSocket server directly
const wss = new WebSocket.Server({ 
    server,
    path: '/ws',  // Specify WebSocket path
    perMessageDeflate: false,
    clientTracking: true
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log('New WebSocket connection:', {
        clientIp,
        path: req.url,
        headers: req.headers,
        timestamp: new Date().toISOString()
    });

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to WebSocket server',
        timestamp: new Date().toISOString()
    }));

    // Handle incoming messages
    ws.on('message', (message) => {
        console.log('Received:', message.toString());
    });

    // Handle connection close
    ws.on('close', () => {
        console.log('Client disconnected:', clientIp);
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Basic route for testing
app.get('/', (req, res) => {
    res.json({ message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        details: err.message
    });
});

// 404 handling
app.use((req, res) => {
    console.log('404 Not Found:', req.url);
    res.status(404).json({
        success: false,
        error: 'Not Found',
        path: req.url
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '192.168.0.10';

server.listen(PORT, HOST, () => {
    console.log(`Server Configuration:`, {
        host: HOST,
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        cors_origins: corsOptions.origin
    });
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`WebSocket server running on ws://${HOST}:${PORT}/ws`);
});

// Error handling
server.on('error', (error) => {
    console.error('Server error:', error);
    // Attempt graceful shutdown
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
    }
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Attempt graceful shutdown
    setTimeout(() => {
        process.exit(1);
    }, 1000);
}); 