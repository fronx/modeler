/**
 * Resume Claude Session API
 * Clears current session and resumes from persisted state.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClaudeManager, getStartOptions } from '@/lib/claude-manager-singleton';
import type { ResumeSessionResponse } from '../../types';

// POST /api/claude-code/sessions/resume
export async function POST(request: NextRequest) {
  try {
    const manager = getClaudeManager();

    // Clear current conversation, then resume from persisted session
    manager.clear('modeler');
    const conversation = manager.resume('modeler', getStartOptions());

    return NextResponse.json<ResumeSessionResponse>({
      status: 'success',
      message: 'Session resumed successfully',
      sessionId: conversation.sessionId,
    });
  } catch (error: any) {
    console.error('Failed to resume session:', error);
    return NextResponse.json(
      { error: 'Failed to resume session', details: error.message },
      { status: 500 },
    );
  }
}
