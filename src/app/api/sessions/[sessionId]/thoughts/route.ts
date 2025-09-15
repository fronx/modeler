import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SESSIONS_DIR = path.join(process.cwd(), 'data/sessions');

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const sessionDir = path.join(SESSIONS_DIR, params.sessionId);

    // Check if session exists
    try {
      await fs.access(sessionDir);
    } catch {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const files = await fs.readdir(sessionDir);
    const nodes: Record<string, any> = {};

    for (const file of files) {
      if (file.endsWith('.json') && file !== '_session.json') {
        try {
          const filePath = path.join(sessionDir, file);
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
      sessionId: params.sessionId,
      loadedAt: new Date().toISOString(),
      count: Object.keys(nodes).length
    });

  } catch (error) {
    console.error('Failed to load session thoughts:', error);
    return NextResponse.json({ error: 'Failed to load session thoughts' }, { status: 500 });
  }
}