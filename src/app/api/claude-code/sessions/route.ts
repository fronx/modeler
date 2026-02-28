/**
 * Claude Sessions API
 * Returns the status of the active 'modeler' conversation.
 */

import { NextResponse } from 'next/server';
import { getClaudeManager } from '@/lib/claude-manager-singleton';

// GET /api/claude-code/sessions - List sessions
export async function GET() {
  try {
    const manager = getClaudeManager();
    const status = manager.getStatus('modeler');

    if (!status.active && !status.hasPersistedSession) {
      return NextResponse.json({ sessions: [] });
    }

    const session = {
      id: status.claudeSessionId ?? status.sessionId ?? 'modeler',
      title: null,
      spaceId: null,
      messageCount: status.messageCount,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    };

    return NextResponse.json({ sessions: [session] });
  } catch (error: any) {
    console.error('Failed to list sessions:', error);
    return NextResponse.json(
      { error: 'Failed to list sessions', details: error.message },
      { status: 500 },
    );
  }
}
