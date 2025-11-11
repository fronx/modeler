import { db, saveSpace, broadcast, ok, err } from '@/lib/api-utils';

export async function GET() {
  try {
    const spaces = await db().listSpaces();

    const formattedSpaces = spaces.map(space => ({
      id: space.id,
      title: space.title,
      description: space.description || '',
      created: new Date(space.createdAt).toISOString(),
      lastModified: new Date(space.updatedAt || space.createdAt).toISOString(),
      thoughtCount: space.nodeCount || 0,
      path: space.id
    }));

    return ok({
      spaces: formattedSpaces,
      count: formattedSpaces.length
    });

  } catch (error) {
    console.error('Failed to load spaces:', error);
    return err('Failed to load spaces', 500);
  }
}

export async function POST(request: Request) {
  try {
    const { title, description } = await request.json();

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

    await saveSpace(newSpace);

    return ok({
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
    return err('Failed to create space', 500);
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const spaceId = searchParams.get('id');

    if (!spaceId) {
      return err('Space ID required', 400);
    }

    const spaceData = await request.json();

    if (!spaceData.metadata || !spaceData.nodes || !spaceData.globalHistory) {
      return err('Invalid space structure. Must have metadata, nodes, and globalHistory', 400);
    }

    spaceData.metadata.id = spaceId;
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