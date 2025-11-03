import { NextResponse } from 'next/server';
import { createDatabase } from '@/lib/database-factory';
import { getThoughtWebSocketServer } from '@/lib/websocket-server';

export async function GET() {
  const db = createDatabase();

  try {
    const spaces = await db.listSpaces();

    // Map to match the expected format for the frontend
    const formattedSpaces = spaces.map(space => ({
      id: space.id,
      title: space.title,
      description: space.description || '',
      created: new Date(space.createdAt).toISOString(),
      lastModified: new Date(space.updatedAt || space.createdAt).toISOString(),
      thoughtCount: space.nodeCount || 0,
      path: space.id
    }));

    return NextResponse.json({
      spaces: formattedSpaces,
      count: formattedSpaces.length
    });

  } catch (error) {
    console.error('Failed to load spaces:', error);
    return NextResponse.json({ error: 'Failed to load spaces' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const db = createDatabase();

  try {
    const { title, description } = await request.json();

    // Create new space
    const spaceId = new Date().toISOString().replace(/[:.]/g, '-');
    const newSpace = {
      metadata: {
        id: spaceId,
        title: title || 'New Space',
        description: description || 'A new cognitive modeling space',
        createdAt: Date.now()
      },
      nodes: {},
      globalHistory: [`Space created: ${new Date().toISOString()}`]
    };

    await db.insertSpace(newSpace);

    // Trigger WebSocket broadcast (required for Turso, redundant but harmless for PostgreSQL)
    const wsServer = getThoughtWebSocketServer();
    if (wsServer) {
      await wsServer.broadcastSpaceUpdate(spaceId);
    }

    return NextResponse.json({
      space: {
        id: spaceId,
        title: newSpace.metadata.title,
        description: newSpace.metadata.description,
        created: new Date(newSpace.metadata.createdAt).toISOString(),
        lastModified: new Date(newSpace.metadata.createdAt).toISOString(),
        thoughtCount: 0,
        path: spaceId
      },
      message: 'Space created successfully'
    });

  } catch (error) {
    console.error('Failed to create space:', error);
    return NextResponse.json({ error: 'Failed to create space' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const db = createDatabase();

  try {
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get('id');

    if (!spaceId) {
      return NextResponse.json({ error: 'Space ID required' }, { status: 400 });
    }

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

    // Trigger WebSocket broadcast (required for Turso, redundant but harmless for PostgreSQL)
    const wsServer = getThoughtWebSocketServer();
    if (wsServer) {
      await wsServer.broadcastSpaceUpdate(spaceId);
    }

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
  }
}