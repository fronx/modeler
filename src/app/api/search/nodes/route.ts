import { NextRequest, NextResponse } from 'next/server';
import { createDatabase } from '@/lib/database-factory';

/**
 * GET /api/search/nodes?q=query&limit=10&threshold=0.5&spaceId=optional
 *
 * Semantic search across nodes in all spaces or within a specific space.
 * Returns nodes ordered by semantic similarity to the query.
 *
 * Query Parameters:
 * - q: Search query (required)
 * - limit: Maximum number of results (default: 10)
 * - threshold: Minimum similarity threshold 0-1 (default: 0.5)
 * - spaceId: Optional - restrict search to specific space
 */
export async function GET(request: NextRequest) {
  const db = createDatabase();

  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const threshold = parseFloat(searchParams.get('threshold') || '0.5');
    const spaceId = searchParams.get('spaceId');

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    // Check if database supports vector search
    if (!('searchAllNodes' in db) || !('searchNodesInSpace' in db)) {
      return NextResponse.json(
        { error: 'Vector search not available with current database backend' },
        { status: 501 }
      );
    }

    let results;
    if (spaceId) {
      results = await db.searchNodesInSpace(spaceId, query, limit, threshold);
    } else {
      results = await db.searchAllNodes(query, limit, threshold);
    }

    return NextResponse.json({
      query,
      spaceId: spaceId || null,
      results,
      count: results.length,
      threshold
    });
  } catch (error: any) {
    console.error('Search nodes error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search nodes' },
      { status: 500 }
    );
  } finally {
    await db.close();
  }
}
