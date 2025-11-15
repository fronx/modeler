/**
 * Server initialization - starts Claude Code session when server starts
 */

import { getSession } from './claude-code-session';
import { getCLISession } from './claude-cli-session';

let initialized = false;

// Helper function to determine session mode at runtime (not cached)
function useCliMode(): boolean {
  return process.env.USE_CLI === 'true';
}

export async function initializeServer() {
  if (initialized) {
    return;
  }

  const isCliMode = useCliMode();
  console.log('[Server Init] Starting server initialization...');
  console.log(`[Server Init] Mode: ${isCliMode ? 'CLI' : 'SDK (Max subscription)'}`);

  try {
    // Initialize Claude Code session with /modeler
    console.log('[Server Init] Starting Claude Code session...');
    const session = isCliMode ? await getCLISession() : await getSession();

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
