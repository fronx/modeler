/**
 * Claude Code Session Management API
 * Reset or stop the persistent conversation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClaudeManager, getStartOptions } from '@/lib/claude-manager-singleton';
import type { SessionActionResponse } from '../types';

// POST /api/claude-code/session - Reset or stop the session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    const manager = getClaudeManager();

    if (action === 'reset') {
      manager.clear('modeler');
      manager.start('modeler', getStartOptions());
      return NextResponse.json<SessionActionResponse>({
        status: 'success',
        message: 'Session reset successfully',
      });
    }

    if (action === 'stop') {
      manager.clear('modeler');
      return NextResponse.json<SessionActionResponse>({
        status: 'success',
        message: 'Session stopped successfully',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "reset" or "stop"' },
      { status: 400 },
    );
  } catch (error: any) {
    console.error('Session management error:', error);
    return NextResponse.json(
      { error: 'Failed to manage session', details: error.message },
      { status: 500 },
    );
  }
}
