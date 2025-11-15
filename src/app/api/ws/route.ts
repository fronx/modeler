/**
 * WebSocket status endpoint
 * Returns information about the WebSocket server (started during server initialization)
 */

import { WEBSOCKET_PORT } from '@/lib/websocket-server';
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'ThoughtWebSocket server is running',
    port: WEBSOCKET_PORT,
    websocketUrl: `ws://localhost:${WEBSOCKET_PORT}`
  });
}