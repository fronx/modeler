/**
 * Claude Code Session Management API
 * Endpoints for managing the persistent Claude Code session
 */

import { NextRequest, NextResponse } from 'next/server';
import { resetSession, stopSession } from '@/lib/claude-code-session';

// POST /api/claude-code/session - Reset the session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'reset') {
      await resetSession();
      return NextResponse.json({
        status: 'success',
        message: 'Session reset successfully'
      });
    }

    if (action === 'stop') {
      stopSession();
      return NextResponse.json({
        status: 'success',
        message: 'Session stopped successfully'
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "reset" or "stop"' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Session management error:', error);
    return NextResponse.json(
      {
        error: 'Failed to manage session',
        details: error.message
      },
      { status: 500 }
    );
  }
}
