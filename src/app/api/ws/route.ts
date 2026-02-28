/**
 * WebSocket status endpoint
 * Returns information about the WebSocket server (started during server initialization)
 *
 * When accessed via a reverse proxy (e.g. modeler.localhost), the WebSocket URL
 * is returned relative to the same host so traffic flows through Caddy.
 * When accessed directly (e.g. localhost:7350), the internal port is returned.
 */

import { WEBSOCKET_PORT } from '@/lib/websocket-server';
import { NextResponse } from 'next/server';
import type { WsInfoResponse } from './types';

export async function GET(request: Request) {
  const host = request.headers.get('host') ?? '';
  const hostname = host.split(':')[0]; // strip port (e.g. modeler.localhost:443 → modeler.localhost)
  // If the hostname is a .localhost subdomain, traffic is going through Caddy over HTTPS.
  // Return a wss:// URL on the same host so WebSocket connections also go through Caddy.
  const isViaProxy = hostname.endsWith('.localhost') && hostname !== 'localhost';
  const websocketUrl = isViaProxy
    ? `wss://${hostname}`
    : `ws://localhost:${WEBSOCKET_PORT}`;

  return NextResponse.json<WsInfoResponse>({
    message: 'ThoughtWebSocket server is running',
    port: WEBSOCKET_PORT,
    websocketUrl,
  });
}
