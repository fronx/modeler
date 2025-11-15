import { db, upsertNode, ok, err } from '@/lib/api-utils';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    const space = await db().getSpace(spaceId);

    if (!space) {
      return err('Space not found', 404);
    }

    return ok({
      nodes: space.nodes,
      spaceId,
      loadedAt: new Date().toISOString(),
      count: Object.keys(space.nodes).length
    });

  } catch (error) {
    console.error('Failed to load space thoughts:', error);
    return err('Failed to load space thoughts', 500);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    const thoughtData = await request.json();

    // Use shared upsertNode (validates space, processes node, broadcasts)
    await upsertNode(spaceId, thoughtData);

    return ok({
      success: true,
      message: `Thought '${thoughtData.id}' added to space ${spaceId}`,
      thoughtId: thoughtData.id,
      spaceId
    });

  } catch (error) {
    console.error('Failed to add thought:', error);
    return err('Failed to add thought', 500);
  }
}