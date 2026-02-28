/**
 * Claude conversation history endpoint.
 * Returns the messages from the active (or resumed) 'modeler' conversation.
 */

import { NextResponse } from 'next/server';
import { getClaudeManager } from '@/lib/claude-manager-singleton';

export async function GET() {
  const manager = getClaudeManager();
  const conversation = manager.get('modeler');

  if (!conversation) {
    return NextResponse.json({ messages: [] });
  }

  // Filter hidden messages and return the rest
  const messages = conversation.messages
    .filter((m: any) => !m.hidden)
    .map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp ?? new Date().toISOString(),
    }));

  return NextResponse.json({ messages });
}
