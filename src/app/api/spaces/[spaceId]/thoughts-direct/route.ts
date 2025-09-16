import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SPACES_DIR = path.join(process.cwd(), 'data/spaces');

export async function GET(
  request: Request,
  { params }: { params: { spaceId: string } }
) {
  try {
    const spaceDir = path.join(SPACES_DIR, params.spaceId);
    const spaceFilePath = path.join(spaceDir, 'space.json');

    // Check if space.json exists
    try {
      await fs.access(spaceFilePath);
    } catch {
      return NextResponse.json({
        error: 'Space not found or not yet executed. Run: npx tsx execute-space.ts ' + params.spaceId
      }, { status: 404 });
    }

    // Read and return the space JSON
    const spaceData = await fs.readFile(spaceFilePath, 'utf-8');
    const parsedData = JSON.parse(spaceData);

    return NextResponse.json({
      ...parsedData,
      loadedAt: new Date().toISOString(),
      source: 'typescript-execution'
    });

  } catch (error) {
    console.error('Failed to load space from TypeScript execution:', error);
    return NextResponse.json({
      error: 'Failed to load space data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}