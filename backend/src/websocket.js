const WebSocket = require('ws');

function setupWebSocket(server) {
    // Create WebSocket server directly on the HTTP server
    const wss = new WebSocket.Server({ 
        server: server,
        path: '/',  // Match the frontend path
        perMessageDeflate: false
    });

    console.log('WebSocket server initialized');

    // Connection handling
    wss.on('connection', (ws, req) => {
        const clientIp = req.socket.remoteAddress;
        console.log('New WebSocket connection:', {
            clientIp,
            headers: req.headers,
            url: req.url,
            timestamp: new Date().toISOString()
        });

        // Set up ping-pong
        ws.isAlive = true;
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        // Send welcome message
        try {
            ws.send(JSON.stringify({
                type: 'welcome',
                message: 'Connected to WebSocket server',
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error('Error sending welcome message:', error);
        }

        // Message handling
        ws.on('message', (message) => {
            console.log('Received:', message.toString());
            try {
                ws.send(JSON.stringify({
                    type: 'echo',
                    message: message.toString(),
                    timestamp: new Date().toISOString()
                }));
            } catch (error) {
                console.error('Error sending message:', error);
            }
        });

        // Error handling
        ws.on('error', (error) => {
            console.error('WebSocket client error:', {
                error,
                clientIp,
                timestamp: new Date().toISOString()
            });
        });

        // Close handling
        ws.on('close', () => {
            console.log('Client disconnected:', {
                clientIp,
                timestamp: new Date().toISOString()
            });
        });
    });

    // Heartbeat check
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                console.log('Terminating inactive connection');
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval);
    });

    // Log active connections every minute
    setInterval(() => {
        console.log('Active WebSocket connections:', wss.clients.size);
    }, 60000);

    return wss;
}

module.exports = setupWebSocket; 