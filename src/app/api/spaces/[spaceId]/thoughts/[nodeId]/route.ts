import { deleteNode, ok, err } from '@/lib/api-utils';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ spaceId: string; nodeId: string }> }
) {
  try {
    const { spaceId, nodeId } = await params;

    // Use shared deleteNode (validates node exists, broadcasts)
    await deleteNode(spaceId, nodeId);

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
