import { createEdge, deleteEdge as deleteEdgeShared, ok, err } from '@/lib/api-utils';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ spaceId: string; edgeId: string }> }
) {
  try {
    const { spaceId, edgeId } = await params;

    // Use shared deleteEdge (validates edge exists, broadcasts)
    await deleteEdgeShared(spaceId, edgeId);

    return ok({
      success: true,
      message: `Edge deleted: ${edgeId}`
    });

  } catch (error) {
    console.error('Failed to delete edge:', error);
    return err('Failed to delete edge', 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ spaceId: string; edgeId: string }> }
) {
  try {
    const { spaceId, edgeId } = await params;
    const edgeData = await request.json();

    // Parse edge ID to get source and target nodes
    // Format: "spaceId:sourceNode:targetNode"
    const parts = edgeId.split(':');
    if (parts.length < 3) {
      return err('Invalid edge ID format', 400);
    }

    const sourceNode = parts[1];
    const targetNode = parts.slice(2).join(':'); // Handle node keys with colons

    // Use shared createEdge (inserts edge with ON CONFLICT, broadcasts)
    await createEdge(
      spaceId,
      sourceNode,
      targetNode,
      edgeData.type,
      edgeData.strength,
      edgeData.gloss
    );

    return ok({
      success: true,
      message: `Edge updated: ${edgeId}`
    });

  } catch (error) {
    console.error('Failed to update edge:', error);
    return err('Failed to update edge', 500);
  }
}
