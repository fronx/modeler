/**
 * WebSocket server for real-time thought updates
 * Watches the file system and pushes changes to connected clients
 */

import { WebSocketServer, WebSocket } from 'ws';
import chokidar from 'chokidar';
import fs from 'fs/promises';
import path from 'path';
import { createServer } from 'http';

const SPACES_DIR = path.join(process.cwd(), 'data/spaces');

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

  private setupFileWatcher(): void {
    // Ensure spaces directory exists
    fs.mkdir(SPACES_DIR, { recursive: true }).catch(() => {});

    // Watch the entire spaces directory tree
    this.watcher = chokidar.watch(SPACES_DIR, {
      ignored: /^\./,
      persistent: true,
      ignoreInitial: true
    });

    this.watcher.on('add', this.handleFileChange.bind(this));
    this.watcher.on('change', this.handleFileChange.bind(this));
    this.watcher.on('unlink', this.handleFileChange.bind(this));
    this.watcher.on('addDir', this.handleSpaceChange.bind(this));
    this.watcher.on('unlinkDir', this.handleSpaceChange.bind(this));

    console.log('👁️  File system watcher started for:', SPACES_DIR);
  }

  private async handleFileChange(filePath: string): Promise<void> {
    const relativePath = path.relative(SPACES_DIR, filePath);
    const pathParts = relativePath.split(path.sep);

    if (pathParts.length < 2) return; // Must be in a space directory

    const spaceId = pathParts[0];
    const fileName = pathParts[pathParts.length - 1];

    console.log(`📁 File changed: ${fileName} in ${spaceId} (full path: ${filePath})`);

    // Handle TypeScript space files - auto-execute when changed
    if (fileName === 'space.ts') {
      console.log(`🚀 Triggering auto-execution for ${spaceId}`);
      await this.autoExecuteSpace(spaceId, filePath);
      return; // The resulting JSON change will trigger another event
    }

    // Handle different file types
    if (fileName.endsWith('.json') && fileName !== '_space.json') {
      // Thought file changed
      await this.broadcastSpaceUpdate(spaceId);
    } else if (fileName === '_space.json') {
      // Space metadata changed
      await this.broadcastSpaceList();
    }
  }

  private async autoExecuteSpace(spaceId: string, tsFilePath: string): Promise<void> {
    try {
      console.log(`🔄 Auto-executing space: ${spaceId}`);

      // First validate TypeScript syntax
      const { exec } = require('child_process');

      await new Promise<void>((resolve, reject) => {
        exec(`npx tsc --noEmit "${tsFilePath}"`, (error) => {
          if (error) {
            console.log(`⚠️  Syntax error in ${spaceId}/space.ts - skipping execution`);
            reject(error);
          } else {
            resolve();
          }
        });
      });

      // If syntax is valid, execute to generate JSON
      await new Promise<void>((resolve, reject) => {
        exec(`npx tsx "${tsFilePath}"`, {
          cwd: process.cwd(),
          maxBuffer: 1024 * 1024 // 1MB buffer for large outputs
        }, async (error, stdout, stderr) => {
          if (error) {
            console.error(`❌ Execution failed for ${spaceId}:`, error.message);
            reject(error);
          } else {
            try {
              // Validate JSON output
              JSON.parse(stdout);

              // Write to space.json
              const jsonPath = path.join(path.dirname(tsFilePath), 'space.json');
              await fs.writeFile(jsonPath, stdout, 'utf8');
              console.log(`✅ Auto-executed ${spaceId} → space.json updated`);
              resolve();
            } catch (parseError) {
              console.error(`❌ Invalid JSON output from ${spaceId}:`, parseError);
              reject(parseError);
            }
          }
        });
      });

    } catch (error) {
      console.error(`Auto-execution failed for ${spaceId}:`, error.message || error);
    }
  }

  private async handleSpaceChange(): Promise<void> {
    // Space directory added/removed
    await this.broadcastSpaceList();
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

  private async broadcastSpaceUpdate(spaceId: string): Promise<void> {
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
    try {
      await fs.mkdir(SPACES_DIR, { recursive: true });

      const spaces = [];
      const spaceDirs = await fs.readdir(SPACES_DIR);

      for (const spaceDir of spaceDirs) {
        const spacePath = path.join(SPACES_DIR, spaceDir);
        const stat = await fs.stat(spacePath);

        if (stat.isDirectory()) {
          try {
            // Read space metadata
            const metaPath = path.join(spacePath, '_space.json');
            const metaContent = await fs.readFile(metaPath, 'utf-8');
            const spaceMeta = JSON.parse(metaContent);

            // Count thought files
            const files = await fs.readdir(spacePath);
            const thoughtCount = files.filter(f => f.endsWith('.json') && f !== '_space.json').length;

            spaces.push({
              ...spaceMeta,
              thoughtCount,
              path: spaceDir
            });

          } catch (error) {
            // If no metadata file, create basic space info
            const files = await fs.readdir(spacePath);
            const thoughtCount = files.filter(f => f.endsWith('.json')).length;

            spaces.push({
              id: spaceDir,
              title: `Space ${spaceDir}`,
              description: `Space with ${thoughtCount} thoughts`,
              created: stat.birthtime.toISOString(),
              lastModified: stat.mtime.toISOString(),
              thoughtCount,
              path: spaceDir
            });
          }
        }
      }

      // Sort by creation time (newest first)
      spaces.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      return spaces;

    } catch (error) {
      console.error('Failed to load spaces:', error);
      return [];
    }
  }

  private async loadSpaceThoughts(spaceId: string): Promise<Record<string, any>> {
    try {
      const spaceDir = path.join(SPACES_DIR, spaceId);
      const files = await fs.readdir(spaceDir);
      const nodes: Record<string, any> = {};

      for (const file of files) {
        if (file.endsWith('.json') && file !== '_space.json') {
          try {
            const filePath = path.join(spaceDir, file);
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
      console.error(`Failed to load space thoughts for ${spaceId}:`, error);
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