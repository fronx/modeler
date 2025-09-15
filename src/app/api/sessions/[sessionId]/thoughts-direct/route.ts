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
    const sessionFilePath = path.join(sessionDir, 'session.json');

    // Check if session.json exists
    try {
      await fs.access(sessionFilePath);
    } catch {
      return NextResponse.json({
        error: 'Session not found or not yet executed. Run: npx tsx execute-session.ts ' + params.sessionId
      }, { status: 404 });
    }

    // Read and return the session JSON
    const sessionData = await fs.readFile(sessionFilePath, 'utf-8');
    const parsedData = JSON.parse(sessionData);

    return NextResponse.json({
      ...parsedData,
      loadedAt: new Date().toISOString(),
      source: 'typescript-execution'
    });

  } catch (error) {
    console.error('Failed to load session from TypeScript execution:', error);
    return NextResponse.json({
      error: 'Failed to load session data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}