const WebSocket = require('ws');
const EventEmitter = require('events');

const wsEmitter = new EventEmitter();

function initializeWebSocket(server) {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
        console.log('Client connected');
        
        ws.on('close', () => console.log('Client disconnected'));
    });

    wsEmitter.on('dataUpdate', () => {
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'refresh' }));
            }
        });
    });

    return wss;
}

module.exports = { initializeWebSocket, wsEmitter }; 