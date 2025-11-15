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
import { createDatabase } from './database-factory';
import type { DatabaseInterface } from './database-factory';

export interface CLISessionConfig {
  workingDir?: string;
  sessionId?: string;  // Resume from this session ID
  spaceId?: string;    // Associate with a cognitive space
}

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: any;
}

interface TextBlock {
  type: 'text';
  text: string;
}

interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  is_error?: boolean;
  content: string | any;
}

type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

interface SDKMessage {
  type: string;
  message?: {
    role: string;
    content: Array<ContentBlock>;
  };
  subtype?: string;
  session_id?: string;
  result?: string;
  permission_denials?: Array<{
    tool_name: string;
    tool_use_id: string;
    tool_input: Record<string, unknown>;
  }>;
  [key: string]: any;
}

export class ClaudeCLISession extends EventEmitter {
  private process: ChildProcess | null = null;
  private sessionId: string | null = null;
  private isReady = false;
  private config: CLISessionConfig;
  private systemPrompt: string;
  private db: DatabaseInterface;
  private messageCount = 0;

  constructor(config: CLISessionConfig = {}) {
    super();
    this.config = {
      workingDir: config.workingDir || process.cwd(),
      sessionId: config.sessionId,
      spaceId: config.spaceId
    };

    // Load the modeler context file
    const modelerPath = join(this.config.workingDir!, '.claude/commands/modeler.md');
    this.systemPrompt = readFileSync(modelerPath, 'utf-8');

    // Use singleton database connection
    this.db = createDatabase();
  }

  /**
   * Start the persistent Claude CLI process
   */
  async start(): Promise<void> {
    if (this.isReady) {
      throw new Error('Session already started');
    }

    console.log('[Claude CLI] Spawning process...');

    // Build args array - add --resume if resuming from existing session
    const args = [
      '--print',
      '--verbose',
      '--output-format', 'stream-json',
      '--input-format', 'stream-json',
      '--system-prompt', this.systemPrompt,
      // Allow safe read-only operations without confirmation
      '--allowed-tools', 'Bash(curl -s -X GET:*)',
      '--allowed-tools', 'Bash(jq:*)',
      '--allowed-tools', 'Bash(ls:*)',
      '--allowed-tools', 'Read',
      '--allowed-tools', 'Grep',
      '--allowed-tools', 'Glob'
    ];

    // Add resume flag if we have a session ID to resume from
    if (this.config.sessionId) {
      args.push('--resume', this.config.sessionId);
      console.log(`[Claude CLI] Resuming session: ${this.config.sessionId}`);
    }

    // Spawn persistent Claude CLI process
    // IMPORTANT: Remove ANTHROPIC_API_KEY from env to use Max subscription instead of API credits
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;

    this.process = spawn('claude', args, {
      cwd: this.config.workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env
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

    // Wait for session ID to arrive (async - don't block startup)
    // Session ID comes from the first message response, not at startup
    this.once('session_ready', () => {
      console.log('[Claude CLI] ✓ Session fully initialized');
    });

    // Give the process a moment to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Handle stdout data from Claude CLI
   */
  private handleStdout(data: string): void {
    const lines = data.split('\n').filter(l => l.trim());

    for (const line of lines) {
      try {
        const msg: SDKMessage = JSON.parse(line);

        // Debug: log all message types we receive
        console.log('[Claude CLI stdout]', msg.type, msg.subtype || '');

        if (msg.type === 'system' && msg.subtype === 'init' && msg.session_id) {
          // Capture session ID
          const previousSessionId = this.sessionId;
          this.sessionId = msg.session_id;

          if (previousSessionId && previousSessionId !== this.sessionId) {
            console.log(`[Claude CLI] ⚠️  Session ID changed! ${previousSessionId} -> ${this.sessionId}`);
          } else if (!previousSessionId) {
            console.log(`[Claude CLI] Session ID: ${this.sessionId}`);
            // Save new session to database
            this.db.saveSession({
              id: this.sessionId,
              spaceId: this.config.spaceId || null,
              messageCount: 0
            }).catch((err: unknown) => console.error('[Claude CLI] Failed to save session:', err));
            this.emit('session_ready');
          } else {
            console.log(`[Claude CLI] ✓ Same session: ${this.sessionId}`);
          }
        } else if (msg.type === 'assistant' && msg.message?.content) {
          // Extract text and tool use from content blocks
          for (const block of msg.message.content) {
            if (block.type === 'text' && block.text) {
              this.emit('data', block.text);
            } else if (block.type === 'tool_use') {
              // Emit tool use event with tool details
              this.emit('tool_use', {
                id: block.id,
                name: block.name,
                input: block.input
              });

              // Log to console for server-side visibility
              console.log('\n[Claude CLI Tool Use]', block.name, {
                id: block.id,
                input: block.input
              });
            }
          }
        } else if (msg.type === 'user' && msg.message?.content) {
          // Tool results come back as user messages with tool_result blocks
          for (const block of msg.message.content) {
            if (block.type === 'tool_result') {
              console.log('\n[Claude CLI Tool Result]', {
                tool_use_id: block.tool_use_id,
                is_error: block.is_error,
                content: typeof block.content === 'string'
                  ? block.content.substring(0, 500) + (block.content.length > 500 ? '...' : '')
                  : block.content
              });
            }
          }
        } else if (msg.type === 'result') {
          // Result event signals conversation is complete for this turn
          console.log('\n[Claude CLI Result Event]', {
            result: msg.result?.substring(0, 100) + '...',
            is_error: msg.is_error,
            duration_ms: msg.duration_ms
          });

          if (msg.permission_denials && msg.permission_denials.length > 0) {
            console.error('\n[Claude CLI Tool Permission Denials]', msg.permission_denials);
            this.emit('tool_denials', msg.permission_denials);
          }

          // Emit both events - message_complete for backward compat, result for proper handling
          this.emit('message_complete', msg);
          this.emit('result', msg);
          console.log('[Claude CLI] Result event emitted, listeners:', this.listenerCount('result'));
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

    // Update session in database
    if (this.sessionId) {
      this.messageCount++;
      this.db.touchSession(this.sessionId).catch((err: unknown) =>
        console.error('[Claude CLI] Failed to update session:', err)
      );
    }
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
    return this.isReady && this.process !== null;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
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

// Singleton manager - persists across Next.js module reloads
class CLISessionManager {
  private static readonly GLOBAL_KEY = Symbol.for('claudeCLISession');

  private static get instance(): ClaudeCLISession | undefined {
    return (global as any)[this.GLOBAL_KEY];
  }

  private static set instance(session: ClaudeCLISession | undefined) {
    (global as any)[this.GLOBAL_KEY] = session;
  }

  static async get(): Promise<ClaudeCLISession> {
    if (!this.instance) {
      console.log('[getCLISession] No global session exists, creating new one');
      this.instance = new ClaudeCLISession();
      await this.instance.start();
    } else if (!this.instance.ready()) {
      console.log('[getCLISession] Session exists but not ready, creating new one');
      console.log('[getCLISession] Debug - isReady:', (this.instance as any).isReady, 'process:', (this.instance as any).process !== null);
      this.instance = new ClaudeCLISession();
      await this.instance.start();
    } else {
      console.log('[getCLISession] ✓ Reusing existing session');
    }
    return this.instance;
  }

  static async reset(): Promise<void> {
    if (this.instance) {
      await this.instance.reset();
    } else {
      this.instance = new ClaudeCLISession();
      await this.instance.start();
    }
  }

  static stop(): void {
    if (this.instance) {
      this.instance.stop();
      this.instance = undefined;
    }
  }
}

/**
 * Get or create the global Claude CLI session
 */
export async function getCLISession(): Promise<ClaudeCLISession> {
  return CLISessionManager.get();
}

/**
 * Reset the global CLI session
 */
export async function resetCLISession(): Promise<void> {
  return CLISessionManager.reset();
}

/**
 * Stop the global CLI session
 */
export function stopCLISession(): void {
  CLISessionManager.stop();
}

/**
 * Resume from a specific session ID
 */
export async function resumeCLISession(sessionId: string, spaceId?: string): Promise<ClaudeCLISession> {
  // Stop current session
  CLISessionManager.stop();

  // Create new session with resume config
  const session = new ClaudeCLISession({ sessionId, spaceId });
  await session.start();

  // Store as global instance
  (CLISessionManager as any).instance = session;

  return session;
}

/**
 * List all saved sessions from database
 */
export async function listCLISessions(): Promise<Array<{
  id: string;
  title: string | null;
  spaceId: string | null;
  messageCount: number;
  createdAt: number;
  lastUsedAt: number;
}>> {
  const db = createDatabase();
  return db.listSessions();
}
