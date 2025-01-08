class WebSocketService {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 5000;
        this.wsUrl = 'ws://192.168.0.10:3000/ws';
        
        console.group('WebSocket Service Initialization');
        console.log('Configuration:', {
            wsUrl: this.wsUrl,
            maxReconnectAttempts: this.maxReconnectAttempts,
            reconnectInterval: this.reconnectInterval,
            timestamp: new Date().toISOString()
        });
        console.groupEnd();
    }

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected');
            return;
        }

        console.group('WebSocket Connection Attempt');
        console.log('Connecting to:', this.wsUrl);

        try {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.addEventListener('open', () => {
                console.log('WebSocket Connected Successfully');
                this.isConnected = true;
                this.reconnectAttempts = 0;
            });

            this.ws.addEventListener('close', (event) => {
                console.log('WebSocket Closed:', {
                    code: event.code,
                    reason: event.reason || 'No reason provided',
                    wasClean: event.wasClean
                });
                
                this.isConnected = false;
                
                if (!event.wasClean && this.ws) {
                    this.ws = null;
                    this.reconnect();
                }
            });

            this.ws.addEventListener('error', (event) => {
                console.error('WebSocket Error:', {
                    readyState: this.ws ? this.getReadyStateString(this.ws.readyState) : 'No WebSocket',
                    error: event
                });
            });

            this.ws.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('WebSocket Message Received:', data);
                    
                    if (data.type === 'welcome') {
                        this.isConnected = true;
                        console.log('Connection confirmed by server');
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            });

        } catch (error) {
            console.error('WebSocket Connection Error:', error);
            this.ws = null;
            this.reconnect();
        }
        
        console.groupEnd();
    }

    disconnect() {
        if (this.ws) {
            console.log('Disconnecting WebSocket...');
            const ws = this.ws;
            this.ws = null;
            this.isConnected = false;
            
            try {
                ws.close(1000, 'Clean disconnect');
            } catch (error) {
                console.error('Error during disconnect:', error);
            }
        }
    }

    reconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectInterval;
            
            console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
            
            setTimeout(() => {
                if (!this.isConnected) {
                    console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                    this.connect();
                }
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }

    getReadyStateString(readyState) {
        switch(readyState) {
            case WebSocket.CONNECTING: return 'CONNECTING (0)';
            case WebSocket.OPEN: return 'OPEN (1)';
            case WebSocket.CLOSING: return 'CLOSING (2)';
            case WebSocket.CLOSED: return 'CLOSED (3)';
            default: return `UNKNOWN (${readyState})`;
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                const message = JSON.stringify(data);
                this.ws.send(message);
                console.log('Message sent:', data);
            } catch (error) {
                console.error('Error sending message:', error);
            }
        } else {
            console.error('Cannot send message: WebSocket is not connected');
        }
    }
}

export const wsService = new WebSocketService();

window.wsDebug = {
    service: wsService,
    connect: () => wsService.connect(),
    disconnect: () => wsService.disconnect(),
    status: () => console.log('WebSocket Status:', {
        isConnected: wsService.isConnected,
        readyState: wsService.ws ? wsService.getReadyStateString(wsService.ws.readyState) : 'No WebSocket',
        reconnectAttempts: wsService.reconnectAttempts
    })
};