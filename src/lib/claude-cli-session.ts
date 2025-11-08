/**
 * Claude CLI Session Manager
 * Uses persistent Claude CLI process with stream-json (no --print mode)
 * This uses Max subscription instead of API credits
 *
 * Performance: ~1.6s avg response time (matches SDK streaming mode)
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { join } from 'path';
import { readFileSync } from 'fs';

export interface CLISessionConfig {
  workingDir?: string;
}

interface SDKMessage {
  type: string;
  message?: {
    role: string;
    content: Array<{ type: string; text?: string }>;
  };
  subtype?: string;
  session_id?: string;
  result?: string;
  [key: string]: any;
}

export class ClaudeCLISession extends EventEmitter {
  private process: ChildProcess | null = null;
  private sessionId: string | null = null;
  private isReady = false;
  private config: CLISessionConfig;
  private systemPrompt: string;

  constructor(config: CLISessionConfig = {}) {
    super();
    this.config = {
      workingDir: config.workingDir || process.cwd()
    };

    // Load the modeler context file
    const modelerPath = join(this.config.workingDir!, '.claude/commands/modeler.md');
    this.systemPrompt = readFileSync(modelerPath, 'utf-8');
  }

  /**
   * Start the persistent Claude CLI process
   */
  async start(): Promise<void> {
    if (this.isReady) {
      throw new Error('Session already started');
    }

    console.log('[Claude CLI] Spawning process...');

    // Spawn persistent Claude CLI process WITH --print for programmatic use
    // But use stream-json input to stream multiple messages to one process
    this.process = spawn('claude', [
      '--print',
      '--verbose',
      '--output-format', 'stream-json',
      '--input-format', 'stream-json',
      '--system-prompt', this.systemPrompt
    ], {
      cwd: this.config.workingDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    console.log(`[Claude CLI] Process PID: ${this.process.pid}`);

    // Set up stdout handler for responses
    this.process.stdout?.on('data', (data) => {
      this.handleStdout(data.toString());
    });

    // Set up stderr handler
    this.process.stderr?.on('data', (data) => {
      const errorMsg = data.toString();
      console.error('[Claude CLI Error]', errorMsg);
      this.emit('error', errorMsg);
    });

    // Handle process exit
    this.process.on('close', (code) => {
      console.log(`[Claude CLI] Process exited with code ${code}`);
      this.isReady = false;
      this.sessionId = null;
      this.emit('closed', code);
    });

    this.isReady = true;

    // Give the process a moment to initialize
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Handle stdout data from Claude CLI
   */
  private handleStdout(data: string): void {
    const lines = data.split('\n').filter(l => l.trim());

    for (const line of lines) {
      try {
        const msg: SDKMessage = JSON.parse(line);

        if (msg.type === 'system' && msg.subtype === 'init' && msg.session_id) {
          // Capture session ID
          const previousSessionId = this.sessionId;
          this.sessionId = msg.session_id;

          if (previousSessionId && previousSessionId !== this.sessionId) {
            console.log(`[Claude CLI] ⚠️  Session ID changed! ${previousSessionId} -> ${this.sessionId}`);
          } else if (!previousSessionId) {
            console.log(`[Claude CLI] Session ID: ${this.sessionId}`);
          } else {
            console.log(`[Claude CLI] ✓ Same session: ${this.sessionId}`);
          }
        } else if (msg.type === 'assistant' && msg.message?.content) {
          // Extract text from content blocks
          for (const block of msg.message.content) {
            if (block.type === 'text' && block.text) {
              this.emit('data', block.text);
            }
          }
        } else if (msg.type === 'result') {
          // Message complete
          this.emit('message_complete', msg);
        }
      } catch (e) {
        // Non-JSON output, ignore
      }
    }
  }

  /**
   * Send a message to the Claude CLI session
   */
  async sendMessage(content: string): Promise<void> {
    if (!this.isReady || !this.process?.stdin) {
      throw new Error('Session not ready. Call start() first.');
    }

    // Format message as stream-json
    const message = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: content
      },
      parent_tool_use_id: null
    });

    // Write to stdin
    this.process.stdin.write(message + '\n');
  }

  /**
   * Stop the session
   */
  stop(): void {
    if (this.process) {
      this.process.stdin?.end();
      this.process.kill();
      this.process = null;
    }

    this.isReady = false;
    this.sessionId = null;
  }

  /**
   * Check if session is ready
   */
  ready(): boolean {
    return this.isReady && this.sessionId !== null;
  }

  /**
   * Reset the session (stop and start fresh)
   */
  async reset(): Promise<void> {
    this.stop();
    this.sessionId = null;
    await this.start();
  }
}

// Global session singleton
let globalCLISession: ClaudeCLISession | null = null;

/**
 * Get or create the global Claude CLI session
 */
export async function getCLISession(): Promise<ClaudeCLISession> {
  if (!globalCLISession || !globalCLISession.ready()) {
    globalCLISession = new ClaudeCLISession();
    await globalCLISession.start();
  }
  return globalCLISession;
}

/**
 * Reset the global CLI session
 */
export async function resetCLISession(): Promise<void> {
  if (globalCLISession) {
    await globalCLISession.reset();
  } else {
    globalCLISession = new ClaudeCLISession();
    await globalCLISession.start();
  }
}

/**
 * Stop the global CLI session
 */
export function stopCLISession(): void {
  if (globalCLISession) {
    globalCLISession.stop();
    globalCLISession = null;
  }
}
