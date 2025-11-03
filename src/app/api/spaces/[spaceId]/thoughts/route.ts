import { NextResponse } from 'next/server';
import { createDatabase } from '@/lib/database-factory';
import { getThoughtWebSocketServer } from '@/lib/websocket-server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const db = createDatabase();

  try {
    const { spaceId } = await params;
    const space = await db.getSpace(spaceId);

    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    return NextResponse.json({
      nodes: space.nodes,
      spaceId: spaceId,
      loadedAt: new Date().toISOString(),
      count: Object.keys(space.nodes).length
    });

  } catch (error) {
    console.error('Failed to load space thoughts:', error);
    return NextResponse.json({ error: 'Failed to load space thoughts' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const db = createDatabase();

  try {
    const { spaceId } = await params;
    const thoughtData = await request.json();

    // Get existing space
    const existingSpace = await db.getSpace(spaceId);
    if (!existingSpace) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    // Validate thought data
    if (!thoughtData.id) {
      return NextResponse.json({ error: 'Thought ID required' }, { status: 400 });
    }

    // Create new thought with defaults
    const newThought = {
      id: thoughtData.id,
      meanings: thoughtData.meanings || [],
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

    // Add thought to space
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

    // Save updated space
    await db.insertSpace(updatedSpace);

    // Trigger WebSocket broadcast (required for Turso, redundant but harmless for PostgreSQL)
    const wsServer = getThoughtWebSocketServer();
    if (wsServer) {
      await wsServer.broadcastSpaceUpdate(spaceId);
    }

    return NextResponse.json({
      success: true,
      message: `Thought '${thoughtData.id}' added to space ${spaceId}`,
      thoughtId: thoughtData.id,
      spaceId: spaceId
    });

  } catch (error) {
    console.error('Failed to add thought:', error);
    return NextResponse.json({
      error: 'Failed to add thought',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}