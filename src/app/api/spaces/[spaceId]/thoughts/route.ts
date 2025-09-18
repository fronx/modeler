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