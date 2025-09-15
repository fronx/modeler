import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const THOUGHTS_DIR = path.join(process.cwd(), 'data/thoughts');

export async function GET() {
  try {
    // Ensure directory exists
    try {
      await fs.mkdir(THOUGHTS_DIR, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    const files = await fs.readdir(THOUGHTS_DIR);
    const nodes: Record<string, any> = {};

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(THOUGHTS_DIR, file);
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
      loadedAt: new Date().toISOString(),
      count: Object.keys(nodes).length
    });

  } catch (error) {
    console.error('Failed to load thoughts:', error);
    return NextResponse.json({ error: 'Failed to load thoughts' }, { status: 500 });
  }
}