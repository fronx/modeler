import { NextResponse } from 'next/server';
import { Database } from '@/lib/database';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const db = new Database();

  try {
    const { spaceId } = await params;
    const space = await db.getSpace(spaceId);

    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...space,
      loadedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to load space:', error);
    return NextResponse.json({ error: 'Failed to load space' }, { status: 500 });
  } finally {
    await db.close();
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const db = new Database();

  try {
    const { spaceId } = await params;
    const spaceData = await request.json();

    // Validate basic structure
    if (!spaceData.metadata || !spaceData.nodes || !spaceData.globalHistory) {
      return NextResponse.json({
        error: 'Invalid space structure. Must have metadata, nodes, and globalHistory'
      }, { status: 400 });
    }

    // Ensure the ID matches
    spaceData.metadata.id = spaceId;

    // Update the space (upsert)
    await db.insertSpace(spaceData);

    return NextResponse.json({
      success: true,
      message: `Space ${spaceId} updated successfully`,
      spaceId: spaceId
    });

  } catch (error) {
    console.error('Failed to update space:', error);
    return NextResponse.json({
      error: 'Failed to update space',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await db.close();
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const db = new Database();

  try {
    const { spaceId } = await params;
    const updates = await request.json();

    // Get existing space
    const existingSpace = await db.getSpace(spaceId);
    if (!existingSpace) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    // Handle simple title update
    if (updates.title && typeof updates.title === 'string') {
      const updatedSpace = {
        ...existingSpace,
        metadata: {
          ...existingSpace.metadata,
          title: updates.title,
          updatedAt: Date.now()
        }
      };

      await db.insertSpace(updatedSpace);

      return NextResponse.json({
        success: true,
        message: `Space title updated to "${updates.title}"`,
        spaceId: spaceId
      });
    }

    // Apply updates - deep merge with proper node merging
    const updatedNodes = { ...existingSpace.nodes };

    // Deep merge individual nodes
    if (updates.nodes) {
      for (const [nodeId, nodeUpdates] of Object.entries(updates.nodes)) {
        if (updatedNodes[nodeId]) {
          // Merge with existing node
          updatedNodes[nodeId] = {
            ...updatedNodes[nodeId],
            ...nodeUpdates,
            // Preserve core fields if not explicitly updated
            id: nodeUpdates.id || updatedNodes[nodeId].id,
            // Merge values object
            values: {
              ...(updatedNodes[nodeId].values || {}),
              ...(nodeUpdates.values || {})
            },
            // Merge history arrays
            history: [
              ...(updatedNodes[nodeId].history || []),
              ...(nodeUpdates.history || [])
            ]
          };
        } else {
          // New node
          updatedNodes[nodeId] = nodeUpdates;
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

    // Update the space
    await db.insertSpace(updatedSpace);

    return NextResponse.json({
      success: true,
      message: `Space ${spaceId} partially updated`,
      spaceId: spaceId,
      updatedFields: Object.keys(updates)
    });

  } catch (error) {
    console.error('Failed to patch space:', error);
    return NextResponse.json({
      error: 'Failed to patch space',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await db.close();
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const db = new Database();

  try {
    const { spaceId } = await params;
    const deleted = await db.deleteSpace(spaceId);

    if (!deleted) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Space ${spaceId} deleted successfully`,
      spaceId: spaceId
    });

  } catch (error) {
    console.error('Failed to delete space:', error);
    return NextResponse.json({
      error: 'Failed to delete space',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await db.close();
  }
}