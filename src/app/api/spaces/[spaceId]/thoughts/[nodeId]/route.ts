import { NextResponse } from 'next/server';
import { createDatabase } from '@/lib/database-factory';
import { getThoughtWebSocketServer } from '@/lib/websocket-server';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ spaceId: string; nodeId: string }> }
) {
  const db = createDatabase();

  try {
    const { spaceId, nodeId } = await params;

    // Delete the node directly from the database
    const deleted = await db.deleteNode(spaceId, nodeId);

    if (!deleted) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    // Trigger WebSocket broadcast
    const wsServer = getThoughtWebSocketServer();
    if (wsServer) {
      await wsServer.broadcastSpaceUpdate(spaceId);
    }

    return NextResponse.json({
      success: true,
      message: `Node '${nodeId}' deleted from space ${spaceId}`,
      nodeId: nodeId,
      spaceId: spaceId
    });

  } catch (error) {
    console.error('Failed to delete node:', error);
    return NextResponse.json({
      error: 'Failed to delete node',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
