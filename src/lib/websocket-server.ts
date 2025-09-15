/**
 * WebSocket server for real-time thought updates
 * Watches the file system and pushes changes to connected clients
 */

import { WebSocketServer, WebSocket } from 'ws';
import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { createServer } from 'http';

const SESSIONS_DIR = path.join(process.cwd(), 'data/sessions');

export class ThoughtWebSocketServer {
  private wss: WebSocketServer;
  private server: any;
  private watcher: any | null = null;
  private clients = new Set<WebSocket>();

  constructor(port = 8080) {
    // Create HTTP server for WebSocket upgrade
    this.server = createServer();
    this.wss = new WebSocketServer({ server: this.server });

    this.setupWebSocketHandlers();
    this.setupFileWatcher();

    this.server.listen(port, () => {
      console.log(`🔗 ThoughtWebSocket server running on port ${port}`);
    });
  }

  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('🔌 Client connected to ThoughtWebSocket');
      this.clients.add(ws);

      // Send initial session list
      this.sendSessionList(ws);

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
      case 'subscribe_session':
        // Client wants to subscribe to updates for a specific session
        await this.sendSessionThoughts(ws, data.sessionId);
        break;

      case 'get_sessions':
        // Client wants current session list
        await this.sendSessionList(ws);
        break;

      default:
        console.warn('Unknown message type:', data.type);
    }
  }

  private setupFileWatcher(): void {
    // Ensure sessions directory exists
    fs.mkdir(SESSIONS_DIR, { recursive: true }).catch(() => {});

    // Watch the entire sessions directory tree
    this.watcher = chokidar.watch(SESSIONS_DIR, {
      ignored: /^\./,
      persistent: true,
      ignoreInitial: true
    });

    this.watcher.on('add', this.handleFileChange.bind(this));
    this.watcher.on('change', this.handleFileChange.bind(this));
    this.watcher.on('unlink', this.handleFileChange.bind(this));
    this.watcher.on('addDir', this.handleSessionChange.bind(this));
    this.watcher.on('unlinkDir', this.handleSessionChange.bind(this));

    console.log('👁️  File system watcher started for:', SESSIONS_DIR);
  }

  private async handleFileChange(filePath: string): Promise<void> {
    const relativePath = path.relative(SESSIONS_DIR, filePath);
    const pathParts = relativePath.split(path.sep);

    if (pathParts.length < 2) return; // Must be in a session directory

    const sessionId = pathParts[0];
    const fileName = pathParts[pathParts.length - 1];

    // Handle different file types
    if (fileName.endsWith('.json') && fileName !== '_session.json') {
      // Thought file changed
      await this.broadcastSessionUpdate(sessionId);
    } else if (fileName === '_session.json') {
      // Session metadata changed
      await this.broadcastSessionList();
    }
  }

  private async handleSessionChange(): Promise<void> {
    // Session directory added/removed
    await this.broadcastSessionList();
  }

  private async sendSessionList(ws: WebSocket): Promise<void> {
    try {
      const sessions = await this.loadSessions();

      ws.send(JSON.stringify({
        type: 'sessions_update',
        sessions,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Failed to send session list:', error);
    }
  }

  private async sendSessionThoughts(ws: WebSocket, sessionId: string): Promise<void> {
    try {
      const thoughts = await this.loadSessionThoughts(sessionId);
      ws.send(JSON.stringify({
        type: 'session_thoughts_update',
        sessionId,
        nodes: thoughts,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error(`Failed to send thoughts for session ${sessionId}:`, error);
    }
  }

  private async broadcastSessionList(): Promise<void> {
    const sessions = await this.loadSessions();
    const message = JSON.stringify({
      type: 'sessions_update',
      sessions,
      timestamp: new Date().toISOString()
    });

    this.broadcast(message);
  }

  private async broadcastSessionUpdate(sessionId: string): Promise<void> {
    const thoughts = await this.loadSessionThoughts(sessionId);
    const message = JSON.stringify({
      type: 'session_thoughts_update',
      sessionId,
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

  private async loadSessions(): Promise<any[]> {
    try {
      await fs.mkdir(SESSIONS_DIR, { recursive: true });

      const sessions = [];
      const sessionDirs = await fs.readdir(SESSIONS_DIR);

      for (const sessionDir of sessionDirs) {
        const sessionPath = path.join(SESSIONS_DIR, sessionDir);
        const stat = await fs.stat(sessionPath);

        if (stat.isDirectory()) {
          try {
            // Read session metadata
            const metaPath = path.join(sessionPath, '_session.json');
            const metaContent = await fs.readFile(metaPath, 'utf-8');
            const sessionMeta = JSON.parse(metaContent);

            // Count thought files
            const files = await fs.readdir(sessionPath);
            const thoughtCount = files.filter(f => f.endsWith('.json') && f !== '_session.json').length;

            sessions.push({
              ...sessionMeta,
              thoughtCount,
              path: sessionDir
            });

          } catch (error) {
            // If no metadata file, create basic session info
            const files = await fs.readdir(sessionPath);
            const thoughtCount = files.filter(f => f.endsWith('.json')).length;

            sessions.push({
              id: sessionDir,
              title: `Session ${sessionDir}`,
              description: `Session with ${thoughtCount} thoughts`,
              created: stat.birthtime.toISOString(),
              lastModified: stat.mtime.toISOString(),
              thoughtCount,
              path: sessionDir
            });
          }
        }
      }

      // Sort by creation time (newest first)
      sessions.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      return sessions;

    } catch (error) {
      console.error('Failed to load sessions:', error);
      return [];
    }
  }

  private async loadSessionThoughts(sessionId: string): Promise<Record<string, any>> {
    try {
      const sessionDir = path.join(SESSIONS_DIR, sessionId);
      const files = await fs.readdir(sessionDir);
      const nodes: Record<string, any> = {};

      for (const file of files) {
        if (file.endsWith('.json') && file !== '_session.json') {
          try {
            const filePath = path.join(sessionDir, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const nodeData = JSON.parse(content);
            nodes[nodeData.id] = nodeData;
          } catch (error) {
            console.error(`Failed to load thought from ${file}:`, error);
          }
        }
      }

      return nodes;

    } catch (error) {
      console.error(`Failed to load session thoughts for ${sessionId}:`, error);
      return {};
    }
  }

  public close(): void {
    if (this.watcher) {
      this.watcher.close();
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
  }
}

export function getThoughtWebSocketServer(): ThoughtWebSocketServer | null {
  return thoughtWSServer;
}