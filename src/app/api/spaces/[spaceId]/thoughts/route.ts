import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SPACES_DIR = path.join(process.cwd(), 'data/spaces');

export async function GET(
  request: Request,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    const spaceDir = path.join(SPACES_DIR, spaceId);

    // Check if space exists
    try {
      await fs.access(spaceDir);
    } catch {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const spaceJsonPath = path.join(spaceDir, 'space.json');
    let nodes: Record<string, any> = {};

    // Try to read space.json (new format)
    try {
      const content = await fs.readFile(spaceJsonPath, 'utf-8');
      const spaceData = JSON.parse(content);

      if (spaceData.thoughtSpace && spaceData.thoughtSpace.nodes) {
        nodes = spaceData.thoughtSpace.nodes;
      }
    } catch (spaceJsonError) {
      console.log(`No space.json found for ${spaceId}, trying legacy format`);

      // Fallback to legacy format (individual JSON files)
      try {
        const files = await fs.readdir(spaceDir);
        for (const file of files) {
          if (file.endsWith('.json') && file !== '_space.json') {
            try {
              const filePath = path.join(spaceDir, file);
              const content = await fs.readFile(filePath, 'utf-8');
              const nodeData = JSON.parse(content);
              nodes[nodeData.id] = nodeData;
            } catch (error) {
              console.error(`Failed to load thought from ${file}:`, error);
            }
          }
        }
      } catch (legacyError) {
        console.error('Failed to load legacy format:', legacyError);
      }
    }

    return NextResponse.json({
      nodes,
      spaceId: spaceId,
      loadedAt: new Date().toISOString(),
      count: Object.keys(nodes).length
    });

  } catch (error) {
    console.error('Failed to load space thoughts:', error);
    return NextResponse.json({ error: 'Failed to load space thoughts' }, { status: 500 });
  }
}