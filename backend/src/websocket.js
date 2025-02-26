const WebSocket = require('ws');
const config = require('./config');

function setupWebSocketServer(server) {
    const wss = new WebSocket.Server({
        server,
        path: config.ws.path
    });

    wss.on('connection', (ws) => {
        ws.isAlive = true;

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

        ws.on('message', (message) => {
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

        ws.on('error', (error) => {
            console.error('WebSocket client error:', error);
        });

        ws.on('close', () => {
            ws.isAlive = false;
        });

        ws.on('pong', () => {
            ws.isAlive = true;
        });
    });

    // Set up ping interval
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, config.ws.pingInterval);

    wss.on('close', () => {
        clearInterval(interval);
    });

    return wss;
}

module.exports = setupWebSocketServer; 