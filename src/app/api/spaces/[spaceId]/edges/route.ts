import { db, createEdge, ok, err } from '@/lib/api-utils';

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

    // Use shared createEdge (inserts edge, broadcasts)
    await createEdge(
      spaceId,
      edgeData.sourceNode,
      edgeData.targetNode,
      edgeData.type,
      edgeData.strength,
      edgeData.gloss
    );

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
