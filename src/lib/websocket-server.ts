/**
 * WebSocket server for real-time thought updates
 * Watches database changes and pushes updates to connected clients
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { Database } from './database';

export class ThoughtWebSocketServer {
  private wss: WebSocketServer;
  private server: any;
  private clients = new Set<WebSocket>();
  private actualPort: number = 8080;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastUpdate: number = Date.now();

  constructor(port = 8080) {
    // Create HTTP server for WebSocket upgrade
    this.server = createServer();
    this.wss = new WebSocketServer({ server: this.server });

    this.setupWebSocketHandlers();
    this.startDatabasePolling();

    this.server.listen(port, () => {
      this.actualPort = port;
      console.log(`🔗 ThoughtWebSocket server running on port ${port}`);
    });

    this.server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use. Please free up port ${port} and restart the server.`);
        console.error(`   Try: lsof -ti :${port} | xargs kill`);
      } else {
        console.error('WebSocket server error:', err);
      }
    });
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

  private startDatabasePolling(): void {
    // Poll database for changes every 2 seconds
    this.pollInterval = setInterval(async () => {
      try {
        await this.checkForUpdates();
      } catch (error) {
        console.error('Database polling error:', error);
      }
    }, 2000);

    console.log('👁️  Database polling started');
  }

  private async checkForUpdates(): Promise<void> {
    const db = new Database();
    try {
      // Check if any spaces have been updated since our last check
      const result = await (db as any).pool.query(`
        SELECT COUNT(*) as count FROM spaces
        WHERE EXTRACT(epoch FROM updated_at) * 1000 > $1
      `, [this.lastUpdate]);

      if (result.rows[0].count > 0) {
        // Update our timestamp and broadcast changes
        this.lastUpdate = Date.now();
        await this.broadcastSpaceList();
      }
    } finally {
      await db.close();
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

  private async broadcastSpaceList(): Promise<void> {
    const spaces = await this.loadSpaces();
    const message = JSON.stringify({
      type: 'spaces_update',
      spaces,
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
    const db = new Database();
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
    } finally {
      await db.close();
    }
  }

  private async loadSpaceThoughts(spaceId: string): Promise<Record<string, any>> {
    const db = new Database();
    try {
      const space = await db.getSpace(spaceId);
      return space?.thoughtSpace.nodes || {};
    } catch (error) {
      console.error(`Failed to load space thoughts for ${spaceId}:`, error);
      return {};
    } finally {
      await db.close();
    }
  }

  public close(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
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