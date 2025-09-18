import { NextResponse } from 'next/server';
import { Database } from '@/lib/database';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const db = new Database();

  try {
    const { spaceId } = await params;
    const { nodeId, itemIndex, checked } = await request.json();

    if (typeof nodeId !== 'string' || typeof itemIndex !== 'number' || typeof checked !== 'boolean') {
      return NextResponse.json({
        error: 'Invalid request. Required: nodeId (string), itemIndex (number), checked (boolean)'
      }, { status: 400 });
    }

    const space = await db.getSpace(spaceId);
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const node = space.thoughtSpace.nodes[nodeId];
    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    if (!node.checkableList || !Array.isArray(node.checkableList)) {
      return NextResponse.json({ error: 'Node does not have a checkable list' }, { status: 400 });
    }

    if (itemIndex < 0 || itemIndex >= node.checkableList.length) {
      return NextResponse.json({ error: 'Item index out of bounds' }, { status: 400 });
    }

    // Update the item
    node.checkableList[itemIndex].checked = checked;

    // Save back to database
    await db.insertSpace(space);

    // Note: WebSocket broadcast happens automatically via PostgreSQL LISTEN/NOTIFY
    // The database trigger will send notifications to all connected clients

    return NextResponse.json({
      success: true,
      item: node.checkableList[itemIndex],
      nodeId,
      itemIndex,
      checked
    });

  } catch (error) {
    console.error('Failed to update item:', error);
    return NextResponse.json({
      error: 'Failed to update item',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await db.close();
  }
}