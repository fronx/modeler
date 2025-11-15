import { db, ok, err } from '@/lib/api-utils';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ spaceId: string; edgeId: string }> }
) {
  try {
    const { edgeId } = await params;

    const deleted = await db().deleteEdge(edgeId);

    if (!deleted) {
      return err('Edge not found', 404);
    }

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

    // Update edge (using insert with ON CONFLICT)
    await db().insertEdge({
      spaceId,
      sourceNode,
      targetNode,
      type: edgeData.type,
      strength: edgeData.strength ?? 0.7,
      gloss: edgeData.gloss
    });

    return ok({
      success: true,
      message: `Edge updated: ${edgeId}`
    });

  } catch (error) {
    console.error('Failed to update edge:', error);
    return err('Failed to update edge', 500);
  }
}
