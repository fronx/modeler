import { db, ok, err } from '@/lib/api-utils';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    const edges = await db().listEdges(spaceId);

    return ok({
      edges,
      spaceId,
      loadedAt: new Date().toISOString(),
      count: edges.length
    });

  } catch (error) {
    console.error('Failed to load edges:', error);
    return err('Failed to load edges', 500);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    const edgeData = await request.json();

    // Validate required fields
    if (!edgeData.sourceNode || !edgeData.targetNode || !edgeData.type) {
      return err('sourceNode, targetNode, and type are required', 400);
    }

    // Insert edge
    await db().insertEdge({
      spaceId,
      sourceNode: edgeData.sourceNode,
      targetNode: edgeData.targetNode,
      type: edgeData.type,
      strength: edgeData.strength ?? 0.7,
      gloss: edgeData.gloss
    });

    return ok({
      success: true,
      message: `Edge created: ${edgeData.sourceNode} -> ${edgeData.targetNode}`,
      spaceId
    });

  } catch (error) {
    console.error('Failed to create edge:', error);
    return err('Failed to create edge', 500);
  }
}
