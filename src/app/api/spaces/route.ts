import { NextResponse } from 'next/server';
import { Database } from '@/lib/database';

export async function GET() {
  const db = new Database();

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
  } finally {
    await db.close();
  }
}

export async function POST(request: Request) {
  const db = new Database();

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
      thoughtSpace: {
        nodes: {},
        globalHistory: [`Space created: ${new Date().toISOString()}`]
      }
    };

    await db.insertSpace(newSpace);

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
  } finally {
    await db.close();
  }
}