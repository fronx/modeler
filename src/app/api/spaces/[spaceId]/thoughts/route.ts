import { db, saveSpace, ok, err } from '@/lib/api-utils';

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

    const existingSpace = await db().getSpace(spaceId);
    if (!existingSpace) {
      return err('Space not found', 404);
    }

    if (!thoughtData.id) {
      return err('Thought ID required', 400);
    }

    const now = Date.now();
    const processedMeanings = (thoughtData.meanings || []).map((meaning: any) => ({
      ...meaning,
      timestamp: meaning.timestamp ?? now
    }));

    const newThought = {
      id: thoughtData.id,
      meanings: processedMeanings,
      values: thoughtData.values || {},
      relationships: thoughtData.relationships || [],
      resolutions: thoughtData.resolutions || [],
      focus: thoughtData.focus !== undefined ? thoughtData.focus : 0.0,
      semanticPosition: thoughtData.semanticPosition !== undefined ? thoughtData.semanticPosition : 0.0,
      history: thoughtData.history || [`Created node: ${thoughtData.id}`],
      ...(thoughtData.branches && { branches: thoughtData.branches }),
      ...(thoughtData.tension && { tension: thoughtData.tension }),
      ...(thoughtData.regularList && { regularList: thoughtData.regularList }),
      ...(thoughtData.checkableList && { checkableList: thoughtData.checkableList })
    };

    const updatedSpace = {
      ...existingSpace,
      nodes: {
        ...existingSpace.nodes,
        [thoughtData.id]: newThought
      },
      globalHistory: [
        ...existingSpace.globalHistory,
        `Created thought: ${thoughtData.id}`
      ]
    };

    await saveSpace(updatedSpace);

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