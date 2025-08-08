import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { supabase } from '../config/database';

// Simple logger implementation
const logger = {
    info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
    warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
    error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
    debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${message}`, ...args),
};

export interface WebSocketMessage {
    type: string;
    payload: any;
    timestamp: string;
    userId?: string;
}

export interface ConnectedClient {
    ws: WebSocket;
    userId: string;
    subscriptions: Set<string>;
    lastPing: Date;
}

class WebSocketService {
    private wss: WebSocketServer | null = null;
    private clients: Map<string, ConnectedClient> = new Map();
    private pingInterval: any = null;

    /**
     * Initialize WebSocket server
     */
    initialize(server: any, port?: number): void {
        this.wss = new WebSocketServer({
            server,
            port,
            path: '/ws',
            verifyClient: this.verifyClient.bind(this)
        });

        this.wss.on('connection', this.handleConnection.bind(this));
        this.wss.on('error', this.handleError.bind(this));

        // Start ping interval to keep connections alive
        this.startPingInterval();

        logger.info('WebSocket server initialized');
    }

    /**
     * Verify client connection (authentication)
     */
    private async verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): Promise<boolean> {
        try {
            const url = new URL(info.req.url || '', `http://${info.req.headers.host}`);
            const token = url.searchParams.get('token');

            if (!token) {
                logger.warn('WebSocket connection rejected: No token provided');
                return false;
            }

            // Verify JWT token with Supabase
            const { data: { user }, error } = await supabase.auth.getUser(token);

            if (error || !user) {
                logger.warn('WebSocket connection rejected: Invalid token');
                return false;
            }

            // Store user info for later use
            (info.req as any).userId = user.id;
            return true;
        } catch (error) {
            logger.error('Error verifying WebSocket client:', error);
            return false;
        }
    }

    /**
     * Handle new WebSocket connection
     */
    private handleConnection(ws: WebSocket, req: IncomingMessage): void {
        const userId = (req as any).userId;

        if (!userId) {
            ws.close(1008, 'Authentication required');
            return;
        }

        const clientId = `${userId}_${Date.now()}`;
        const client: ConnectedClient = {
            ws,
            userId,
            subscriptions: new Set(),
            lastPing: new Date(),
        };

        this.clients.set(clientId, client);
        logger.info(`WebSocket client connected: ${clientId} (user: ${userId})`);

        // Set up message handlers
        ws.on('message', (data) => {
            const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
            this.handleMessage(clientId, buffer);
        });
        ws.on('close', () => this.handleDisconnection(clientId));
        ws.on('error', (error) => this.handleClientError(clientId, error));
        ws.on('pong', () => this.handlePong(clientId));

        // Send welcome message
        this.sendToClient(clientId, {
            type: 'connection_established',
            payload: { clientId, userId },
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Handle incoming message from client
     */
    private handleMessage(clientId: string, data: Buffer): void {
        try {
            const message = JSON.parse(data.toString()) as WebSocketMessage;
            const client = this.clients.get(clientId);

            if (!client) {
                logger.warn(`Message from unknown client: ${clientId}`);
                return;
            }

            logger.debug(`WebSocket message from ${clientId}:`, message);

            switch (message.type) {
                case 'subscribe':
                    this.handleSubscription(clientId, message.payload);
                    break;
                case 'unsubscribe':
                    this.handleUnsubscription(clientId, message.payload);
                    break;
                case 'ping':
                    this.handlePing(clientId);
                    break;
                default:
                    logger.warn(`Unknown message type: ${message.type}`);
            }
        } catch (error) {
            logger.error(`Error handling WebSocket message from ${clientId}:`, error);
        }
    }

    /**
     * Handle client subscription to specific channels
     */
    private handleSubscription(clientId: string, payload: { channels: string[] }): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        payload.channels.forEach(channel => {
            client.subscriptions.add(channel);
            logger.debug(`Client ${clientId} subscribed to ${channel}`);
        });

        this.sendToClient(clientId, {
            type: 'subscription_confirmed',
            payload: { channels: payload.channels },
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Handle client unsubscription from channels
     */
    private handleUnsubscription(clientId: string, payload: { channels: string[] }): void {
        const client = this.clients.get(clientId);
        if (!client) return;

        payload.channels.forEach(channel => {
            client.subscriptions.delete(channel);
            logger.debug(`Client ${clientId} unsubscribed from ${channel}`);
        });
    }

    /**
     * Handle ping from client
     */
    private handlePing(clientId: string): void {
        const client = this.clients.get(clientId);
        if (client) {
            client.lastPing = new Date();
            client.ws.pong();
        }
    }

    /**
     * Handle pong response from client
     */
    private handlePong(clientId: string): void {
        const client = this.clients.get(clientId);
        if (client) {
            client.lastPing = new Date();
        }
    }

    /**
     * Handle client disconnection
     */
    private handleDisconnection(clientId: string): void {
        const client = this.clients.get(clientId);
        if (client) {
            logger.info(`WebSocket client disconnected: ${clientId} (user: ${client.userId})`);
            this.clients.delete(clientId);
        }
    }

    /**
     * Handle client error
     */
    private handleClientError(clientId: string, error: Error): void {
        logger.error(`WebSocket client error for ${clientId}:`, error);
        this.clients.delete(clientId);
    }

    /**
     * Handle WebSocket server error
     */
    private handleError(error: Error): void {
        logger.error('WebSocket server error:', error);
    }

    /**
     * Send message to specific client
     */
    private sendToClient(clientId: string, message: WebSocketMessage): void {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            try {
                client.ws.send(JSON.stringify(message));
            } catch (error) {
                logger.error(`Error sending message to client ${clientId}:`, error);
                this.clients.delete(clientId);
            }
        }
    }

    /**
     * Broadcast message to all clients subscribed to a channel
     */
    broadcastToChannel(channel: string, message: Omit<WebSocketMessage, 'timestamp'>): void {
        const fullMessage: WebSocketMessage = {
            ...message,
            timestamp: new Date().toISOString(),
        };

        let sentCount = 0;
        this.clients.forEach((client, clientId) => {
            if (client.subscriptions.has(channel)) {
                this.sendToClient(clientId, fullMessage);
                sentCount++;
            }
        });

        logger.debug(`Broadcasted message to ${sentCount} clients on channel: ${channel}`);
    }

    /**
     * Send message to specific user (all their connections)
     */
    sendToUser(userId: string, message: Omit<WebSocketMessage, 'timestamp'>): void {
        const fullMessage: WebSocketMessage = {
            ...message,
            timestamp: new Date().toISOString(),
            userId,
        };

        let sentCount = 0;
        this.clients.forEach((client, clientId) => {
            if (client.userId === userId) {
                this.sendToClient(clientId, fullMessage);
                sentCount++;
            }
        });

        logger.debug(`Sent message to ${sentCount} connections for user: ${userId}`);
    }

    /**
     * Send generation progress update
     */
    sendGenerationProgress(userId: string, jobId: string, progress: number, status: string, result?: any, error?: string): void {
        this.sendToUser(userId, {
            type: 'generation_progress',
            payload: {
                jobId,
                progress,
                status,
                result,
                error,
            },
        });
    }

    /**
     * Send training progress update
     */
    sendTrainingProgress(userId: string, jobId: string, progress: number, status: string, currentStep?: string, error?: string): void {
        this.sendToUser(userId, {
            type: 'training_progress',
            payload: {
                jobId,
                progress,
                status,
                currentStep,
                error,
            },
        });
    }

    /**
     * Send credit balance update
     */
    sendCreditUpdate(userId: string, newBalance: number, transaction: any): void {
        this.sendToUser(userId, {
            type: 'credit_balance_update',
            payload: {
                userId,
                newBalance,
                transaction,
            },
        });
    }

    /**
     * Send feed update
     */
    sendFeedUpdate(type: 'new_content' | 'like' | 'comment', contentId: string, data: any): void {
        this.broadcastToChannel('public:feed', {
            type: 'feed_update',
            payload: {
                type,
                contentId,
                data,
            },
        });
    }

    /**
     * Send notification
     */
    sendNotification(userId: string, notification: any): void {
        this.sendToUser(userId, {
            type: 'notification',
            payload: notification,
        });
    }

    /**
     * Start ping interval to keep connections alive
     */
    private startPingInterval(): void {
        this.pingInterval = setInterval(() => {
            const now = new Date();
            const timeout = 30000; // 30 seconds

            this.clients.forEach((client, clientId) => {
                const timeSinceLastPing = now.getTime() - client.lastPing.getTime();

                if (timeSinceLastPing > timeout) {
                    logger.warn(`Client ${clientId} timed out, closing connection`);
                    client.ws.terminate();
                    this.clients.delete(clientId);
                } else if (client.ws.readyState === WebSocket.OPEN) {
                    client.ws.ping();
                }
            });
        }, 15000); // Check every 15 seconds
    }

    /**
     * Get connection statistics
     */
    getStats(): { totalConnections: number; userConnections: { [userId: string]: number } } {
        const userConnections: { [userId: string]: number } = {};

        this.clients.forEach(client => {
            userConnections[client.userId] = (userConnections[client.userId] || 0) + 1;
        });

        return {
            totalConnections: this.clients.size,
            userConnections,
        };
    }

    /**
     * Shutdown WebSocket server
     */
    shutdown(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        this.clients.forEach((client) => {
            client.ws.close(1001, 'Server shutting down');
        });

        this.clients.clear();

        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }

        logger.info('WebSocket server shut down');
    }
}

export const websocketService = new WebSocketService();