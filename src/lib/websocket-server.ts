/**
 * WebSocket server for real-time thought updates
 * Uses PostgreSQL LISTEN/NOTIFY for instant push notifications
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { DatabaseConfig } from './database';
import { createDatabase } from './database-factory';
import { Client } from 'pg';

export class ThoughtWebSocketServer {
  private wss: WebSocketServer;
  private server: any;
  private clients = new Set<WebSocket>();
  private actualPort: number = 8080;
  private notificationClient: Client | null = null;
  private dbConfig: DatabaseConfig;

  constructor(port = 8080, dbConfig: DatabaseConfig = {}) {
    this.dbConfig = dbConfig;

    // Create HTTP server for WebSocket upgrade
    this.server = createServer();
    this.wss = new WebSocketServer({ server: this.server });

    this.setupWebSocketHandlers();
    this.setupDatabaseNotifications();

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

  private async setupDatabaseNotifications(): Promise<void> {
    const dbType = process.env.DATABASE_TYPE || 'postgres';

    // Only set up LISTEN/NOTIFY for PostgreSQL
    if (dbType !== 'postgres') {
      console.log('📡 Using update-then-reload pattern for real-time updates (Turso mode)');
      console.log('   Broadcasts triggered explicitly after API writes');
      return;
    }

    try {
      // Create a dedicated client for notifications (must stay connected)
      this.notificationClient = new Client({
        host: this.dbConfig.host || '127.0.0.1',
        port: this.dbConfig.port || 54322,
        database: this.dbConfig.database || 'postgres',
        user: this.dbConfig.user || 'postgres',
        password: this.dbConfig.password || 'postgres'
      });

      await this.notificationClient.connect();

      // Listen for space changes
      await this.notificationClient.query('LISTEN space_changes');

      // Handle notifications
      this.notificationClient.on('notification', async (msg) => {
        if (msg.channel === 'space_changes') {
          try {
            const payload = JSON.parse(msg.payload || '{}');
            console.log('📢 Database notification:', payload);

            // Broadcast updates to all connected clients
            await this.handleSpaceChange(payload);
          } catch (error) {
            console.error('Failed to parse notification payload:', error);
          }
        }
      });

      console.log('👁️  PostgreSQL LISTEN/NOTIFY notifications started');

    } catch (error) {
      console.error('Failed to setup database notifications:', error);
      throw new Error('Database notifications are required - cannot start WebSocket server without push notifications');
    }
  }

  private async handleSpaceChange(payload: any): Promise<void> {
    const { operation, space_id } = payload;

    if (operation === 'INSERT' || operation === 'UPDATE' || operation === 'DELETE') {
      // Broadcast updated space list to all clients
      await this.broadcastSpaceList();

      // If it's an update to a specific space, also broadcast its thoughts
      if (operation === 'UPDATE' && space_id) {
        await this.broadcastSpaceUpdate(space_id);
      }
    }
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
    } finally {
      await db.close();
    }
  }

  private async loadSpaceThoughts(spaceId: string): Promise<Record<string, any>> {
    const db = createDatabase();
    try {
      const space = await db.getSpace(spaceId);
      return space?.nodes || {};
    } catch (error) {
      console.error(`Failed to load space thoughts for ${spaceId}:`, error);
      return {};
    } finally {
      await db.close();
    }
  }

  public close(): void {
    if (this.notificationClient) {
      this.notificationClient.end();
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