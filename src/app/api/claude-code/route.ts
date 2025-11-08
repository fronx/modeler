/**
 * Claude Code Relay API endpoint
 * Forwards chat requests to Claude Code running as a persistent server process
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/claude-code-session';

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
    const session = await getSession();

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

          const onClose = () => {
            if (!responseComplete) {
              responseComplete = true;
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          };

          const onMessageComplete = () => {
            session.off('data', onData);
            session.off('error', onError);
            session.off('message_complete', onMessageComplete);
            onClose();
          };

          session.on('data', onData);
          session.on('error', onError);
          session.on('message_complete', onMessageComplete);

          // Send the message to the session
          await session.sendMessage(fullPrompt);

          // Set a timeout as backup
          setTimeout(() => {
            if (!responseComplete) {
              session.off('data', onData);
              session.off('error', onError);
              session.off('message_complete', onMessageComplete);
              onClose();
            }
          }, 60000); // 60 second timeout for response

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
    const session = await getSession();
    return NextResponse.json({
      status: session.ready() ? 'ready' : 'starting',
      hint: 'Set CLAUDE_CODE_PATH environment variable to specify custom Claude Code binary location'
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message
    }, { status: 500 });
  }
}
