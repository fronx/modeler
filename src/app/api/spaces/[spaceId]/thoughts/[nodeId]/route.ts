import { db, broadcast, ok, err } from '@/lib/api-utils';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ spaceId: string; nodeId: string }> }
) {
  try {
    const { spaceId, nodeId } = await params;

    const deleted = await db().deleteNode(spaceId, nodeId);

    if (!deleted) {
      return err('Node not found', 404);
    }

    await broadcast(spaceId);

    return ok({
      success: true,
      message: `Node '${nodeId}' deleted from space ${spaceId}`,
      nodeId,
      spaceId
    });

  } catch (error) {
    console.error('Failed to delete node:', error);
    return err(
      'Failed to delete node',
      500
    );
  }
}
