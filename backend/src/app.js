const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');
const recordRoutes = require('./routes/recordRoutes');
const outboundRoutes = require('./routes/outboundRoutes');
const storeRoutes = require('./routes/storeRoutes');
const userRoutes = require('./routes/userRoutes');
const locationRoutes = require('./routes/locationRoutes');
const groupRoutes = require('./routes/groupRoutes');
const salesRoutes = require('./routes/salesRoutes');
const rmaRoutes = require('./routes/rmaRoutes');
const orderRoutes = require('./routes/orderRoutes');
const inventoryRmaRoutes = require('./routes/inventoryRmaRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const tagRoutes = require('./routes/tagRoutes');
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const dataProcessRoutes = require('./routes/dataProcessRoutes');

console.log('Environment:', {
    NODE_ENV: config.nodeEnv,
    HOST: config.host,
    PORT: config.port
});

const app = express();
const server = http.createServer(app);

// CORS configuration
const corsOptions = {
    origin: config.cors.origin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
};

app.use(cors(corsOptions));

// 靜態文件服務
const publicPath = config.nodeEnv === 'production'
    ? path.join(config.passenger.appRoot, 'public')
    : path.join(__dirname, '../public');

console.log('Static files path:', publicPath);
app.use(express.static(publicPath));

// 只對 API 路由設置 JSON 內容類型
app.use('/api', (req, res, next) => {
    res.type('application/json');
    next();
});

app.use(express.json());

// JWT Secret check
if (!config.jwt.secret) {
    console.error('JWT secret is not configured');
    process.exit(1);
}

// API Routes
app.use('/api/records', recordRoutes);
app.use('/api/outbound', outboundRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/rma', rmaRoutes);
app.use('/api/inventory/rma', inventoryRmaRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/data-process', dataProcessRoutes);

// Create WebSocket server
const wss = new WebSocket.Server({ 
    server,
    path: config.ws.path,
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

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Error handling middleware for API routes
app.use('/api', errorHandler);

// API 404 handling
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `API path ${req.url} not found`
        }
    });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'), (err) => {
        if (err) {
            console.error('Error sending index.html:', err);
            res.status(500).send('Error loading application');
        }
    });
});

// Start server
const HOST = '0.0.0.0';  // 綁定到所有網絡接口

server.listen(config.port, HOST, () => {
    console.log(`Server Configuration:`, {
        host: config.host,
        bind_address: HOST,
        port: config.port,
        environment: config.nodeEnv,
        cors_origins: config.cors.origin,
        static_path: publicPath,
        db_host: config.db.host
    });
    console.log(`Server running on http://${config.host}:${config.port}`);
    console.log(`WebSocket server running on ws://${config.host}:${config.port}${config.ws.path}`);
});

// Error handling
server.on('error', (error) => {
    console.error('Server error:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${config.port} is already in use`);
        process.exit(1);
    }
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    setTimeout(() => {
        process.exit(1);
    }, 1000);
}); 