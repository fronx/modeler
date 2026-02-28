/**
 * Claude Code Relay API endpoint
 * Forwards chat requests to a persistent ClaudeManager conversation.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getClaudeManager,
  getStartOptions,
  ReadableStreamAdapter,
  asServerResponse,
} from '@/lib/claude-manager-singleton';
import type { ClaudeCodeStatusResponse } from './types';
import { createDatabase } from '@/lib/database-factory';

/**
 * Format space data as a system context message for Claude
 */
async function formatSpaceContext(spaceId: string): Promise<string> {
  const db = createDatabase();
  const space = await db.getSpace(spaceId);

  if (!space) {
    return `[Space context: ${spaceId} (not found)]`;
  }

  const nodeCount = Object.keys(space.nodes).length;
  const nodeList = Object.entries(space.nodes)
    .map(([nodeKey, nodeData]) => {
      const meanings = nodeData.meanings?.map((m: any) => `  - ${m.content} (${(m.confidence * 100).toFixed(0)}%)`).join('\n') || '';
      const relationships = nodeData.relationships?.map((r: any) => `  - ${r.type} → ${r.target} (strength: ${r.strength})`).join('\n') || '';
      const values = nodeData.values ? `\n  Values: ${JSON.stringify(nodeData.values)}` : '';

      return `### ${nodeKey}
${meanings ? `Meanings:\n${meanings}\n` : ''}${relationships ? `Relationships:\n${relationships}\n` : ''}${values}`;
    })
    .join('\n\n');

  return `<space_context>
You are working in cognitive space: **${space.metadata.title}**
Description: ${space.metadata.description}
Space ID: ${spaceId}

This space contains ${nodeCount} thought node${nodeCount !== 1 ? 's' : ''}:

${nodeList || '(No nodes yet)'}

Use the MCP cognitive-spaces tools to interact with this space:
- mcp__cognitive-spaces__create_node - Add new thoughts
- mcp__cognitive-spaces__delete_node - Remove thoughts
- mcp__cognitive-spaces__get_space - Refresh space data
- mcp__cognitive-spaces__create_edge - Add relationships
</space_context>`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, spaceId, isSpaceSwitch } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 },
      );
    }

    // Build the full prompt with optional space context
    let fullPrompt = message;
    if (spaceId) {
      const spaceContext = await formatSpaceContext(spaceId);
      if (isSpaceSwitch) {
        fullPrompt = `${spaceContext}\n\nI have switched to this cognitive space. Please respond with a brief acknowledgment (1-2 sentences) that you've reviewed the space content and are ready to work with it. Do NOT summarize or list the nodes - just confirm you're ready.\n\n${message}`;
      } else {
        fullPrompt = `${spaceContext}\n\n${message}`;
      }
    }

    // Get or start the 'modeler' conversation
    const manager = getClaudeManager();
    const conversation =
      manager.get('modeler') ?? manager.start('modeler', getStartOptions());

    let adapterRef: ReadableStreamAdapter;

    const readable = new ReadableStream({
      start(controller) {
        adapterRef = new ReadableStreamAdapter(controller);
        conversation.subscribe(asServerResponse(adapterRef));
        conversation.send(fullPrompt);
      },
      cancel() {
        // Client disconnected — fires 'close', library auto-removes from activeStreams
        adapterRef?.destroy();
      },
    });

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Claude Code relay error:', error);
    return NextResponse.json(
      {
        error: 'Failed to relay message to Claude Code',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

// GET endpoint to check Claude Code session status
export async function GET() {
  try {
    const manager = getClaudeManager();
    const status = manager.getStatus('modeler');
    return NextResponse.json<ClaudeCodeStatusResponse>({
      status: status.active ? 'ready' : 'starting',
      mode: 'library',
      billing: 'Max subscription',
      ...status,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', error: error.message },
      { status: 500 },
    );
  }
}
