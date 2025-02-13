const WebSocket = require('ws');
const EventEmitter = require('events');

const HEARTBEAT_INTERVAL = 30000;
const CLOSE_TIMEOUT = 3000;

class WebSocketServer {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.emitter = new EventEmitter();
        this.init();
    }

    init() {
        this.wss.on('connection', (ws, req) => {
            ws.isAlive = true;
            ws.ip = req.socket.remoteAddress;

            // Setup heartbeat
            ws.on('pong', () => {
                ws.isAlive = true;
            });

            // Handle messages
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleMessage(ws, message);
                } catch (err) {
                    console.error('WebSocket message error:', err);
                }
            });

            // Handle connection close
            ws.on('close', () => {
                console.log('Client disconnected:', ws.ip);
            });

            // Send welcome message
            this.sendToClient(ws, {
                type: 'welcome',
                message: 'Connected to WebSocket server'
            });
        });

        // Heartbeat checking
        this.heartbeatInterval = setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (!ws.isAlive) {
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, HEARTBEAT_INTERVAL);
    }

    handleMessage(ws, message) {
        // Add message handling logic here
        this.emitter.emit('message', { ws, message });
    }

    broadcast(data) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                this.sendToClient(client, data);
            }
        });
    }

    sendToClient(ws, data) {
        try {
            ws.send(JSON.stringify(data));
        } catch (err) {
            console.error('WebSocket send error:', err);
        }
    }

    cleanup() {
        clearInterval(this.heartbeatInterval);
        this.wss.close(() => {
            console.log('WebSocket server closed');
        });
    }
}

module.exports = WebSocketServer; 