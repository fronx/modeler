import { NextResponse } from 'next/server';
import { getThoughtWebSocketServer } from '@/lib/websocket-server';

export async function POST(
  request: Request,
  { params }: { params: { spaceId: string } }
) {
  try {
    const wsServer = getThoughtWebSocketServer();

    if (!wsServer) {
      return NextResponse.json({
        error: 'WebSocket server not running'
      }, { status: 503 });
    }

    await wsServer.broadcastSpaceUpdate(params.spaceId);

    return NextResponse.json({
      success: true,
      message: `WebSocket update broadcast for space: ${params.spaceId}`
    });

  } catch (error) {
    console.error(`Failed to broadcast update for space ${params.spaceId}:`, error);
    return NextResponse.json({
      error: 'Failed to broadcast update'
    }, { status: 500 });
  }
}