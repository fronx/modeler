/**
 * Server initialization - starts ClaudeManager conversation and WebSocket server
 */

import { getClaudeManager, getStartOptions } from './claude-manager-singleton';
import { startThoughtWebSocketServer } from './websocket-server';

let initialized = false;

export async function initializeServer() {
  if (initialized) {
    return;
  }

  console.log('[Server Init] Starting server initialization...');

  try {
    // Start WebSocket server first
    console.log('[Server Init] Starting WebSocket server...');
    startThoughtWebSocketServer();
    console.log('[Server Init] WebSocket server started');

    // Initialize ClaudeManager and start the 'modeler' conversation
    console.log('[Server Init] Starting Claude conversation...');
    const manager = getClaudeManager();
    manager.start('modeler', getStartOptions());
    console.log('[Server Init] Claude conversation started');

    initialized = true;
  } catch (error) {
    console.error('[Server Init] Failed to initialize:', error);
    // Don't throw - allow server to start even if Claude fails
  }
}
