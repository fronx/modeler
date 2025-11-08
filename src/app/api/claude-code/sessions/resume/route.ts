/**
 * Resume Claude CLI Session API
 * Resume a conversation from a specific session ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { resumeCLISession } from '@/lib/claude-cli-session';

// POST /api/claude-code/sessions/resume - Resume from session ID
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, spaceId } = body;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'sessionId is required and must be a string' },
        { status: 400 }
      );
    }

    console.log(`[API] Resuming Claude CLI session: ${sessionId}`);

    await resumeCLISession(sessionId, spaceId);

    return NextResponse.json({
      status: 'success',
      message: `Session ${sessionId} resumed successfully`,
      sessionId
    });
  } catch (error: any) {
    console.error('Failed to resume session:', error);
    return NextResponse.json(
      {
        error: 'Failed to resume session',
        details: error.message
      },
      { status: 500 }
    );
  }
}
