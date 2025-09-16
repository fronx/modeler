import { NextResponse } from 'next/server';
import { getThoughtWebSocketServer } from '@/lib/websocket-server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    const wsServer = getThoughtWebSocketServer();

    if (!wsServer) {
      return NextResponse.json({
        error: 'WebSocket server not running'
      }, { status: 503 });
    }

    await wsServer.broadcastSpaceUpdate(spaceId);

    return NextResponse.json({
      success: true,
      message: `WebSocket update broadcast for space: ${spaceId}`
    });

  } catch (error) {
    const { spaceId } = await params;
    console.error(`Failed to broadcast update for space ${spaceId}:`, error);
    return NextResponse.json({
      error: 'Failed to broadcast update'
    }, { status: 500 });
  }
}