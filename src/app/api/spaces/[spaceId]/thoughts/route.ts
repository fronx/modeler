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

    // Check if space exists
    try {
      await fs.access(spaceDir);
    } catch {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const files = await fs.readdir(spaceDir);
    const nodes: Record<string, any> = {};

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

    return NextResponse.json({
      nodes,
      spaceId: params.spaceId,
      loadedAt: new Date().toISOString(),
      count: Object.keys(nodes).length
    });

  } catch (error) {
    console.error('Failed to load space thoughts:', error);
    return NextResponse.json({ error: 'Failed to load space thoughts' }, { status: 500 });
  }
}