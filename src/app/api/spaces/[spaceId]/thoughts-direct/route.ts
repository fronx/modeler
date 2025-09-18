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
      return NextResponse.json({
        error: 'Space not found in database. Create space first.'
      }, { status: 404 });
    }

    return NextResponse.json({
      ...space,
      loadedAt: new Date().toISOString(),
      source: 'database'
    });

  } catch (error) {
    console.error('Failed to load space from database:', error);
    return NextResponse.json({
      error: 'Failed to load space data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await db.close();
  }
}