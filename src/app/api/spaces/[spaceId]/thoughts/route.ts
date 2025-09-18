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
      nodes: space.thoughtSpace.nodes,
      spaceId: spaceId,
      loadedAt: new Date().toISOString(),
      count: Object.keys(space.thoughtSpace.nodes).length
    });

  } catch (error) {
    console.error('Failed to load space thoughts:', error);
    return NextResponse.json({ error: 'Failed to load space thoughts' }, { status: 500 });
  } finally {
    await db.close();
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const db = new Database();

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
      thoughtSpace: {
        ...existingSpace.thoughtSpace,
        nodes: {
          ...existingSpace.thoughtSpace.nodes,
          [thoughtData.id]: newThought
        },
        globalHistory: [
          ...existingSpace.thoughtSpace.globalHistory,
          `Created thought: ${thoughtData.id}`
        ]
      }
    };

    // Save updated space
    await db.insertSpace(updatedSpace);

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
  } finally {
    await db.close();
  }
}