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
      ...space,
      loadedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to load space:', error);
    return err('Failed to load space', 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    const spaceData = await request.json();

    if (!spaceData.metadata || !spaceData.nodes || !spaceData.globalHistory) {
      return err('Invalid space structure. Must have metadata, nodes, and globalHistory', 400);
    }

    // Process all node meanings to add timestamps if missing
    const now = Date.now();
    const processedNodes: Record<string, any> = {};

    for (const [nodeId, node] of Object.entries(spaceData.nodes)) {
      const typedNode = node as any;
      processedNodes[nodeId] = {
        ...typedNode,
        meanings: typedNode.meanings
          ? typedNode.meanings.map((meaning: any) => ({
              ...meaning,
              timestamp: meaning.timestamp ?? now
            }))
          : []
      };
    }

    spaceData.metadata.id = spaceId;
    spaceData.nodes = processedNodes;
    await saveSpace(spaceData);

    return ok({
      success: true,
      message: `Space ${spaceId} updated successfully`,
      spaceId
    });

  } catch (error) {
    console.error('Failed to update space:', error);
    return err('Failed to update space', 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    const updates = await request.json();

    const existingSpace = await db().getSpace(spaceId);
    if (!existingSpace) {
      return err('Space not found', 404);
    }

    if (updates.title && typeof updates.title === 'string') {
      const updatedSpace = {
        ...existingSpace,
        metadata: {
          ...existingSpace.metadata,
          title: updates.title,
          updatedAt: Date.now()
        }
      };

      await saveSpace(updatedSpace);

      return ok({
        success: true,
        message: `Space title updated to "${updates.title}"`,
        spaceId
      });
    }

    if (updates.description && typeof updates.description === 'string') {
      const updatedSpace = {
        ...existingSpace,
        metadata: {
          ...existingSpace.metadata,
          description: updates.description,
          updatedAt: Date.now()
        }
      };

      await saveSpace(updatedSpace);

      return ok({
        success: true,
        message: `Space description updated`,
        spaceId
      });
    }

    const updatedNodes = { ...existingSpace.nodes };

    if (updates.nodes) {
      const now = Date.now();

      for (const [nodeId, nodeUpdates] of Object.entries(updates.nodes)) {
        const typedUpdates = nodeUpdates as any;

        // Process meanings to add timestamps if missing
        const processedMeanings = typedUpdates.meanings
          ? typedUpdates.meanings.map((meaning: any) => ({
              ...meaning,
              timestamp: meaning.timestamp ?? now
            }))
          : undefined;

        if (updatedNodes[nodeId]) {
          updatedNodes[nodeId] = {
            ...updatedNodes[nodeId],
            ...typedUpdates,
            id: typedUpdates.id || updatedNodes[nodeId].id,
            ...(processedMeanings && { meanings: processedMeanings }),
            values: {
              ...(updatedNodes[nodeId].values || {}),
              ...(typedUpdates.values || {})
            },
            history: [
              ...(updatedNodes[nodeId].history || []),
              ...(typedUpdates.history || [])
            ]
          };
        } else {
          updatedNodes[nodeId] = {
            ...typedUpdates,
            ...(processedMeanings && { meanings: processedMeanings })
          };
        }
      }
    }

    const updatedSpace = {
      ...existingSpace,
      metadata: {
        ...existingSpace.metadata,
        ...(updates.metadata || {})
      },
      nodes: updatedNodes,
      globalHistory: updates.globalHistory || existingSpace.globalHistory
    };

    await saveSpace(updatedSpace);

    return ok({
      success: true,
      message: `Space ${spaceId} partially updated`,
      spaceId,
      updatedFields: Object.keys(updates)
    });

  } catch (error) {
    console.error('Failed to patch space:', error);
    return err('Failed to patch space', 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    const deleted = await db().deleteSpace(spaceId);

    if (!deleted) {
      return err('Space not found', 404);
    }

    return ok({
      success: true,
      message: `Space ${spaceId} deleted successfully`,
      spaceId
    });

  } catch (error) {
    console.error('Failed to delete space:', error);
    return err('Failed to delete space', 500);
  }
}