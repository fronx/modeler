/**
 * Claude Code Relay API endpoint
 * Forwards chat requests to Claude Code running as a persistent server process
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/claude-code-session';
import { getCLISession } from '@/lib/claude-cli-session';
import { createDatabase } from '@/lib/database-factory';

// Helper function to determine session mode at runtime (not cached)
function useCliMode(): boolean {
  return process.env.USE_CLI === 'true';
}

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
        { status: 400 }
      );
    }

    // Build the full prompt for Claude Code
    let fullPrompt = message;

    // If we have a space context, format it with full space data
    if (spaceId) {
      const spaceContext = await formatSpaceContext(spaceId);

      // For space switches, give Claude explicit instructions about how to respond
      if (isSpaceSwitch) {
        fullPrompt = `${spaceContext}\n\nI have switched to this cognitive space. Please respond with a brief acknowledgment (1-2 sentences) that you've reviewed the space content and are ready to work with it. Do NOT summarize or list the nodes - just confirm you're ready.\n\n${message}`;
      } else {
        fullPrompt = `${spaceContext}\n\n${message}`;
      }
    }

    // Get or create the persistent Claude Code session
    // Default to SDK mode (supports Max subscription + proper cancel support)
    // Set USE_CLI=true environment variable to use CLI mode instead
    const session = useCliMode() ? await getCLISession() : await getSession();

    // Start streaming response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          let responseComplete = false;

          // Listen for data from the session
          const onData = (text: string) => {
            if (!responseComplete) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
            }
          };

          const onError = (error: string) => {
            if (!responseComplete) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error })}\n\n`));
            }
          };

          const onToolUse = (toolUse: { id: string; name: string; input: any }) => {
            if (!responseComplete) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'tool_use',
                tool_use: toolUse
              })}\n\n`));
            }
          };

          const onToolDenials = (denials: any[]) => {
            if (!responseComplete) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'tool_denials',
                denials
              })}\n\n`));
            }
          };

          let timeoutId: NodeJS.Timeout | null = null;
          let cleanedUp = false;

          const cleanup = () => {
            if (cleanedUp) return;
            cleanedUp = true;

            // Clear timeout
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            // Remove event listeners
            session.off('data', onData);
            session.off('error', onError);
            session.off('tool_use', onToolUse);
            session.off('tool_denials', onToolDenials);
            session.off('result', onResult);
          };

          const onResult = (msg: any) => {
            // 'result' event means THIS conversation turn is complete (all tools executed)
            // Close THIS request's stream, but the persistent session stays alive
            console.log('[Claude Code API] Result event received, closing stream');

            if (!responseComplete) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'result',
                result: msg.result,
                is_error: msg.is_error
              })}\n\n`));
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));

              // Mark complete and cleanup listeners BEFORE closing controller
              // This prevents race condition where error events fire after close
              responseComplete = true;
              cleanup();

              // Now safe to close controller - no more events can fire
              controller.close();
            }
          };

          session.on('data', onData);
          session.on('error', onError);
          session.on('tool_use', onToolUse);
          session.on('tool_denials', onToolDenials);
          session.on('result', onResult);
          console.log('[Claude Code API] Event listeners attached, result listeners:', session.listenerCount('result'));

          // Send the message to the session
          await session.sendMessage(fullPrompt);

          // Safety timeout - close HTTP stream for frontend but keep listeners attached
          // Result will arrive soon after and cleanup will happen in onResult()
          timeoutId = setTimeout(() => {
            if (!responseComplete) {
              console.warn('[Claude Code API] Stream timeout - closing HTTP stream only');

              // Mark complete and clear timeout BEFORE closing controller
              responseComplete = true;
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }

              // Send final message and close
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();

              // DON'T call cleanup() - keep listeners attached
              // Result will arrive soon and cleanup will happen in onResult()
              // This prevents the 2.2x delay caused by removing listeners
            }
          }, 60000); // 60 second timeout

        } catch (error: any) {
          console.error('Streaming error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            error: error.message
          })}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },
    });

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Claude Code relay error:', error);
    return NextResponse.json(
      {
        error: 'Failed to relay message to Claude Code',
        details: error.message
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check Claude Code session status
export async function GET() {
  try {
    const isCliMode = useCliMode();
    const session = isCliMode ? await getCLISession() : await getSession();
    return NextResponse.json({
      status: session.ready() ? 'ready' : 'starting',
      mode: isCliMode ? 'cli' : 'sdk',
      billing: 'Max subscription (works with both modes)',
      hint: isCliMode
        ? 'Using CLI mode. Unset USE_CLI to use SDK mode (recommended for cancel support).'
        : 'Using SDK mode with Max subscription. SDK provides proper cancellation support.'
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 });
  }
}
