/**
 * WebSocket endpoint to start the thought WebSocket server
 * This initializes the file watcher when the Next.js app starts
 */

import { startThoughtWebSocketServer, getThoughtWebSocketServer } from '@/lib/websocket-server';
import { NextResponse } from 'next/server';

// Start WebSocket server when this module loads
startThoughtWebSocketServer();

export async function GET() {
  const server = getThoughtWebSocketServer();
  const port = server?.getPort() || 0;

  return NextResponse.json({
    message: 'ThoughtWebSocket server is running',
    port,
    websocketUrl: `ws://localhost:${port}`
  });
}