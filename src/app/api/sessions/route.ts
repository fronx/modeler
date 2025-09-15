import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SESSIONS_DIR = path.join(process.cwd(), 'data/sessions');

export async function GET() {
  try {
    // Ensure sessions directory exists
    await fs.mkdir(SESSIONS_DIR, { recursive: true });

    const sessions = [];
    const sessionDirs = await fs.readdir(SESSIONS_DIR);

    for (const sessionDir of sessionDirs) {
      const sessionPath = path.join(SESSIONS_DIR, sessionDir);
      const stat = await fs.stat(sessionPath);

      if (stat.isDirectory()) {
        try {
          // Read session metadata
          const metaPath = path.join(sessionPath, '_session.json');
          const metaContent = await fs.readFile(metaPath, 'utf-8');
          const sessionMeta = JSON.parse(metaContent);

          // Count thought files
          const files = await fs.readdir(sessionPath);
          const thoughtCount = files.filter(f => f.endsWith('.json') && f !== '_session.json').length;

          sessions.push({
            ...sessionMeta,
            thoughtCount,
            path: sessionDir
          });

        } catch (error) {
          // If no metadata file, create basic session info
          const files = await fs.readdir(sessionPath);
          const thoughtCount = files.filter(f => f.endsWith('.json')).length;

          sessions.push({
            id: sessionDir,
            title: `Session ${sessionDir}`,
            description: `Legacy session with ${thoughtCount} thoughts`,
            created: stat.birthtime.toISOString(),
            lastModified: stat.mtime.toISOString(),
            thoughtCount,
            path: sessionDir
          });
        }
      }
    }

    // Sort by creation time (newest first)
    sessions.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    return NextResponse.json({
      sessions,
      count: sessions.length
    });

  } catch (error) {
    console.error('Failed to load sessions:', error);
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { title, description } = await request.json();

    // Create new session
    const sessionId = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionDir = path.join(SESSIONS_DIR, sessionId);
    await fs.mkdir(sessionDir, { recursive: true });

    // Create session metadata
    const sessionMeta = {
      id: sessionId,
      title: title || `New Session`,
      description: description || 'A new cognitive modeling session',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      thoughtCount: 0
    };

    // Save metadata
    const metaPath = path.join(sessionDir, '_session.json');
    await fs.writeFile(metaPath, JSON.stringify(sessionMeta, null, 2));

    return NextResponse.json({
      session: { ...sessionMeta, path: sessionId },
      message: 'Session created successfully'
    });

  } catch (error) {
    console.error('Failed to create session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}