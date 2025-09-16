import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SPACES_DIR = path.join(process.cwd(), 'data/spaces');

export async function GET() {
  try {
    // Ensure spaces directory exists
    await fs.mkdir(SPACES_DIR, { recursive: true });

    const spaces = [];
    const spaceDirs = await fs.readdir(SPACES_DIR);

    for (const spaceDir of spaceDirs) {
      const spacePath = path.join(SPACES_DIR, spaceDir);
      const stat = await fs.stat(spacePath);

      if (stat.isDirectory()) {
        try {
          // Read space metadata
          const metaPath = path.join(spacePath, '_space.json');
          const metaContent = await fs.readFile(metaPath, 'utf-8');
          const spaceMeta = JSON.parse(metaContent);

          // Count thought files
          const files = await fs.readdir(spacePath);
          const thoughtCount = files.filter(f => f.endsWith('.json') && f !== '_space.json').length;

          spaces.push({
            ...spaceMeta,
            thoughtCount,
            path: spaceDir
          });

        } catch (error) {
          // If no metadata file, create basic space info
          const files = await fs.readdir(spacePath);
          const thoughtCount = files.filter(f => f.endsWith('.json')).length;

          spaces.push({
            id: spaceDir,
            title: `Space ${spaceDir}`,
            description: `Legacy space with ${thoughtCount} thoughts`,
            created: stat.birthtime.toISOString(),
            lastModified: stat.mtime.toISOString(),
            thoughtCount,
            path: spaceDir
          });
        }
      }
    }

    // Sort by creation time (newest first)
    spaces.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    return NextResponse.json({
      spaces,
      count: spaces.length
    });

  } catch (error) {
    console.error('Failed to load spaces:', error);
    return NextResponse.json({ error: 'Failed to load spaces' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { title, description } = await request.json();

    // Create new space
    const spaceId = new Date().toISOString().replace(/[:.]/g, '-');
    const spaceDir = path.join(SPACES_DIR, spaceId);
    await fs.mkdir(spaceDir, { recursive: true });

    // Create space metadata
    const spaceMeta = {
      id: spaceId,
      title: title || `New Space`,
      description: description || 'A new cognitive modeling space',
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      thoughtCount: 0
    };

    // Save metadata
    const metaPath = path.join(spaceDir, '_space.json');
    await fs.writeFile(metaPath, JSON.stringify(spaceMeta, null, 2));

    return NextResponse.json({
      space: { ...spaceMeta, path: spaceId },
      message: 'Space created successfully'
    });

  } catch (error) {
    console.error('Failed to create space:', error);
    return NextResponse.json({ error: 'Failed to create space' }, { status: 500 });
  }
}