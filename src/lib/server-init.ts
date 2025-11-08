/**
 * Server initialization - starts Claude Code session when server starts
 */

import { getSession } from './claude-code-session';

let initialized = false;

export async function initializeServer() {
  if (initialized) {
    return;
  }

  console.log('[Server Init] Starting server initialization...');

  try {
    // Initialize Claude Code session with /modeler
    console.log('[Server Init] Starting Claude Code session...');
    const session = await getSession();

    if (session.ready()) {
      console.log('[Server Init] ✓ Claude Code session ready with /modeler loaded');
    } else {
      console.warn('[Server Init] ⚠ Claude Code session started but not ready yet');
    }

    initialized = true;
  } catch (error) {
    console.error('[Server Init] ✗ Failed to initialize Claude Code session:', error);
    // Don't throw - allow server to start even if Claude Code fails
  }
}
