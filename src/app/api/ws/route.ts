/**
 * WebSocket endpoint to start the thought WebSocket server
 * This initializes the file watcher when the Next.js app starts
 */

import { startThoughtWebSocketServer } from '@/lib/websocket-server';
import { NextResponse } from 'next/server';

// Start WebSocket server when this module loads
startThoughtWebSocketServer();

export async function GET() {
  return NextResponse.json({
    message: 'ThoughtWebSocket server is running',
    websocketUrl: 'ws://localhost:8080'
  });
}