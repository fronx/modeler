/**
 * Claude CLI Sessions API
 * List and manage saved conversation sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { listCLISessions } from '@/lib/claude-cli-session';

// GET /api/claude-code/sessions - List all saved sessions
export async function GET() {
  try {
    const sessions = await listCLISessions();
    return NextResponse.json({ sessions });
  } catch (error: any) {
    console.error('Failed to list sessions:', error);
    return NextResponse.json(
      {
        error: 'Failed to list sessions',
        details: error.message
      },
      { status: 500 }
    );
  }
}
