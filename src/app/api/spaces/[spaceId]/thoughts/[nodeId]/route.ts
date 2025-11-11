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
    const t0 = Date.now();
    const deleted = await db.deleteNode(spaceId, nodeId);
    const t1 = Date.now();
    console.log(`[DELETE] deleteNode took ${t1 - t0}ms`);

    if (!deleted) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    // Trigger WebSocket broadcast (fire-and-forget for better response time)
    const wsServer = getThoughtWebSocketServer();
    if (wsServer) {
      wsServer.broadcastSpaceUpdate(spaceId).catch(error => {
        console.error('[DELETE] WebSocket broadcast failed:', error);
      });
    }

    const t4 = Date.now();
    console.log(`[DELETE] Total request time: ${t4 - t0}ms`);

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
