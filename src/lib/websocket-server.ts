/**
 * WebSocket server for real-time thought updates
 * Uses explicit broadcast pattern after database writes
 *
 * Runs on fixed port 8080 with HTTP API for cross-process broadcasts
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { createDatabase } from './database-factory';

export const WEBSOCKET_PORT = 3002;

export class ThoughtWebSocketServer {
  private wss: WebSocketServer;
  private server: any;
  private clients = new Set<WebSocket>();
  private actualPort: number = 0;

  constructor() {
    // Create HTTP server for WebSocket upgrade AND broadcast API
    this.server = createServer((req, res) => this.handleHttpRequest(req, res));
    this.wss = new WebSocketServer({ server: this.server });

    this.setupWebSocketHandlers();

    // Listen on fixed port
    this.server.listen(WEBSOCKET_PORT, () => {
      this.actualPort = this.server.address().port;
      console.log(`🔗 ThoughtWebSocket server running on port ${this.actualPort}`);
      console.log(`   - WebSocket: ws://localhost:${this.actualPort}`);
      console.log(`   - HTTP API: http://localhost:${this.actualPort}/broadcast`);
    });

    this.server.on('error', (err: any) => {
      if ((err as any).code === 'EADDRINUSE') {
        console.log(`⚠️  Port ${WEBSOCKET_PORT} already in use (server already running)`);
        // Store the port even if we couldn't bind - another process is serving it
        this.actualPort = WEBSOCKET_PORT;
      } else {
        console.error('WebSocket server error:', err);
      }
    });
  }

  /**
   * Handle HTTP requests for cross-process broadcast API
   */
  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    // Enable CORS for local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/broadcast') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        try {
          const { type, spaceId } = JSON.parse(body);

          switch (type) {
            case 'space_update':
              await this.broadcastSpaceUpdate(spaceId);
              break;
            case 'space_created':
              this.broadcastSpaceCreated(spaceId);
              await this.broadcastSpaceUpdate(spaceId);
              await this.broadcastSpaceList();
              break;
            case 'space_list':
              await this.broadcastSpaceList();
              break;
            default:
              throw new Error(`Unknown broadcast type: ${type}`);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          console.error('Broadcast error:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error'
          }));
        }
      });
      return;
    }

    // Health check endpoint
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        port: this.actualPort,
        clients: this.clients.size
      }));
      return;
    }

    // Not found
    res.writeHead(404);
    res.end();
  }

  public getPort(): number {
    return this.actualPort;
  }

  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔌 Client connected to ThoughtWebSocket');
      this.clients.add(ws);

      // Send initial space list
      this.sendSpaceList(ws);

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          await this.handleClientMessage(ws, data);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('🔌 Client disconnected from ThoughtWebSocket');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });
  }


  private async handleClientMessage(ws: WebSocket, data: any): Promise<void> {
    switch (data.type) {
      case 'subscribe_space':
        // Client wants to subscribe to updates for a specific space
        await this.sendSpaceThoughts(ws, data.spaceId);
        break;

      case 'get_spaces':
        // Client wants current space list
        await this.sendSpaceList(ws);
        break;

      default:
        console.warn('Unknown message type:', data.type);
    }
  }

  private async sendSpaceList(ws: WebSocket): Promise<void> {
    try {
      const spaces = await this.loadSpaces();

      ws.send(JSON.stringify({
        type: 'spaces_update',
        spaces,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Failed to send space list:', error);
    }
  }

  private async sendSpaceThoughts(ws: WebSocket, spaceId: string): Promise<void> {
    try {
      const thoughts = await this.loadSpaceThoughts(spaceId);
      ws.send(JSON.stringify({
        type: 'space_thoughts_update',
        spaceId,
        nodes: thoughts,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error(`Failed to send thoughts for space ${spaceId}:`, error);
    }
  }

  public async broadcastSpaceList(): Promise<void> {
    const spaces = await this.loadSpaces();
    const message = JSON.stringify({
      type: 'spaces_update',
      spaces,
      timestamp: new Date().toISOString()
    });

    this.broadcast(message);
  }

  public broadcastSpaceCreated(spaceId: string): void {
    const message = JSON.stringify({
      type: 'space_created',
      spaceId,
      timestamp: new Date().toISOString()
    });

    this.broadcast(message);
  }

  public async broadcastSpaceUpdate(spaceId: string): Promise<void> {
    const thoughts = await this.loadSpaceThoughts(spaceId);
    const message = JSON.stringify({
      type: 'space_thoughts_update',
      spaceId,
      nodes: thoughts,
      timestamp: new Date().toISOString()
    });

    this.broadcast(message);
  }

  private broadcast(message: string): void {
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private async loadSpaces(): Promise<any[]> {
    const db = createDatabase();
    try {
      const spaces = await db.listSpaces();
      return spaces.map(space => ({
        id: space.id,
        title: space.title,
        description: space.description,
        created: new Date(space.createdAt).toISOString(),
        lastModified: new Date(space.updatedAt).toISOString(),
        thoughtCount: space.nodeCount,
        path: space.id
      }));
    } catch (error) {
      console.error('Failed to load spaces from database:', error);
      return [];
    }
    // Don't close - database is now a singleton managed by database-factory
  }

  private async loadSpaceThoughts(spaceId: string): Promise<Record<string, any>> {
    const db = createDatabase();
    try {
      const space = await db.getSpace(spaceId);
      return space?.nodes || {};
    } catch (error) {
      console.error(`Failed to load space thoughts for ${spaceId}:`, error);
      return {};
    }
    // Don't close - database is now a singleton managed by database-factory
  }

  public close(): void {
    this.wss.close();
    this.server.close();
  }
}

// Export singleton instance
let thoughtWSServer: ThoughtWebSocketServer | null = null;

export function startThoughtWebSocketServer(): void {
  if (!thoughtWSServer) {
    thoughtWSServer = new ThoughtWebSocketServer();

    // Cleanup on process exit
    const cleanup = () => {
      if (thoughtWSServer) {
        console.log('🔌 Shutting down ThoughtWebSocket server...');
        thoughtWSServer.close();
        thoughtWSServer = null;
      }
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }
}

export function getThoughtWebSocketServer(): ThoughtWebSocketServer | null {
  return thoughtWSServer;
}