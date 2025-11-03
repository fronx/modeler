import { NextRequest, NextResponse } from 'next/server';
import { createDatabase } from '@/lib/database-factory';

/**
 * GET /api/search/spaces?q=query&limit=10
 *
 * Semantic search across all cognitive spaces.
 * Returns spaces ordered by semantic similarity to the query.
 *
 * Query Parameters:
 * - q: Search query (required)
 * - limit: Maximum number of results (default: 10)
 */
export async function GET(request: NextRequest) {
  const db = createDatabase();

  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    // Check if database supports vector search
    if (!('searchSpaces' in db)) {
      return NextResponse.json(
        { error: 'Vector search not available with current database backend' },
        { status: 501 }
      );
    }

    const results = await db.searchSpaces(query, limit);

    return NextResponse.json({
      query,
      results,
      count: results.length
    });
  } catch (error: any) {
    console.error('Search spaces error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search spaces' },
      { status: 500 }
    );
  }
}
