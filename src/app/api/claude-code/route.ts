/**
 * Claude Code Relay API endpoint
 * Forwards chat requests to Claude Code running as a persistent server process
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/claude-code-session';
import { getCLISession } from '@/lib/claude-cli-session';

// Choose session type based on environment variable
// Default to CLI mode (Max subscription) unless USE_SDK is explicitly set
// Set USE_SDK=true to use API key mode instead
const USE_CLI_MODE = process.env.USE_SDK !== 'true';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, spaceId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Build the full prompt for Claude Code
    let fullPrompt = message;

    // If we have a space context, add it
    if (spaceId) {
      fullPrompt = `[Space context: ${spaceId}] ${fullPrompt}`;
    }

    // Get or create the persistent Claude Code session
    // Based on environment variable, use either CLI (Max subscription) or SDK (API key)
    const session = USE_CLI_MODE ? await getCLISession() : await getSession();

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

          const cleanup = () => {
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

            // Always cleanup listeners, even if responseComplete is true (timeout fired)
            cleanup();

            if (!responseComplete) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'result',
                result: msg.result,
                is_error: msg.is_error
              })}\n\n`));
              // Close this HTTP response stream (not the persistent session)
              responseComplete = true;
              try {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
              } catch (e) {
                // Controller already closed - ignore
              }
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
              responseComplete = true;

              // Clear this timeout
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }

              // Close HTTP stream for frontend
              try {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
              } catch (e) {
                // Controller already closed
              }

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
    const session = USE_CLI_MODE ? await getCLISession() : await getSession();
    return NextResponse.json({
      status: session.ready() ? 'ready' : 'starting',
      mode: USE_CLI_MODE ? 'cli' : 'sdk',
      billing: USE_CLI_MODE ? 'Max subscription' : 'API credits',
      hint: USE_CLI_MODE
        ? 'Using Claude CLI (Max subscription) - default. Set USE_SDK=true to use API key instead.'
        : 'Using Agent SDK (API key). Remove USE_SDK=true to use Max subscription instead.'
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 });
  }
}
