import { db, saveSpace, upsertNode, ok, err } from '@/lib/api-utils';

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

    // Verify space exists
    const existingSpace = await db().getSpace(spaceId);
    if (!existingSpace) {
      return err('Space not found', 404);
    }

    const updatedFields: string[] = [];

    // Handle metadata updates granularly
    if (updates.title || updates.description) {
      const metadataUpdates: { title?: string; description?: string } = {};
      if (updates.title && typeof updates.title === 'string') {
        metadataUpdates.title = updates.title;
        updatedFields.push('title');
      }
      if (updates.description && typeof updates.description === 'string') {
        metadataUpdates.description = updates.description;
        updatedFields.push('description');
      }
      await db().updateSpaceMetadata(spaceId, metadataUpdates);
    }

    // Handle node updates granularly
    if (updates.nodes) {
      for (const [nodeId, nodeUpdates] of Object.entries(updates.nodes)) {
        const typedUpdates = nodeUpdates as any;

        // Get existing node for merging
        const existingNode = existingSpace.nodes[nodeId];

        const mergedNode = existingNode
          ? {
              ...existingNode,
              ...typedUpdates,
              id: typedUpdates.id || existingNode.id,
              values: {
                ...(existingNode.values || {}),
                ...(typedUpdates.values || {})
              },
              history: [
                ...(existingNode.history || []),
                ...(typedUpdates.history || [])
              ]
            }
          : typedUpdates;

        // Use shared upsertNode (processes data with defaults, broadcasts)
        await upsertNode(spaceId, mergedNode);
      }
      updatedFields.push('nodes');
    }

    // Handle global history updates
    if (updates.globalHistory && Array.isArray(updates.globalHistory)) {
      // Append new history entries
      const existingHistoryLength = existingSpace.globalHistory.length;
      const newEntries = updates.globalHistory.slice(existingHistoryLength);

      for (const entry of newEntries) {
        await db().appendGlobalHistory(spaceId, entry);
      }
      updatedFields.push('globalHistory');
    }

    // Handle metadata object (for other metadata fields)
    if (updates.metadata && typeof updates.metadata === 'object') {
      const metadataUpdates: { title?: string; description?: string } = {};
      if (updates.metadata.title) {
        metadataUpdates.title = updates.metadata.title;
      }
      if (updates.metadata.description) {
        metadataUpdates.description = updates.metadata.description;
      }
      if (metadataUpdates.title || metadataUpdates.description) {
        await db().updateSpaceMetadata(spaceId, metadataUpdates);
        updatedFields.push('metadata');
      }
    }

    return ok({
      success: true,
      message: `Space ${spaceId} partially updated`,
      spaceId,
      updatedFields
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