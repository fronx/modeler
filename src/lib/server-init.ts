/**
 * Server initialization - starts Claude Code session when server starts
 */

import { getSession } from './claude-code-session';
import { getCLISession } from './claude-cli-session';

let initialized = false;

// Choose session type based on environment variable
// Default to CLI mode (Max subscription) unless USE_SDK is explicitly set
const USE_CLI_MODE = process.env.USE_SDK !== 'true';

export async function initializeServer() {
  if (initialized) {
    return;
  }

  console.log('[Server Init] Starting server initialization...');
  console.log(`[Server Init] Mode: ${USE_CLI_MODE ? 'CLI (Max subscription)' : 'SDK (API key)'}`);

  try {
    // Initialize Claude Code session with /modeler
    console.log('[Server Init] Starting Claude Code session...');
    const session = USE_CLI_MODE ? await getCLISession() : await getSession();

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
