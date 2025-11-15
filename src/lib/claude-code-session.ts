/**
 * Claude Code Session Manager
 * Manages a persistent Claude Agent SDK session with /modeler context loaded
 * Uses AsyncIterable streaming for truly persistent sessions (VSCode-like performance)
 */

import { query, Query, SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { EventEmitter } from 'events';
import { join } from 'path';
import { readFileSync } from 'fs';
import { createDatabase } from './database-factory';
import type { DatabaseInterface } from './database-factory';

export interface SessionConfig {
  workingDir?: string;
  spaceId?: string;    // Associate with a cognitive space
}

/**
 * Async generator that yields user messages on demand
 * This enables continuous message streaming without creating new processes
 */
class MessageStream {
  private resolveNext: ((msg: SDKUserMessage) => void) | null = null;
  private messageQueue: SDKUserMessage[] = [];
  private stopped = false;

  async *generate(): AsyncGenerator<SDKUserMessage, void> {
    while (!this.stopped) {
      const msg = await this.nextMessage();
      if (msg) {
        yield msg;
      }
    }
  }

  private nextMessage(): Promise<SDKUserMessage | null> {
    return new Promise((resolve) => {
      if (this.messageQueue.length > 0) {
        resolve(this.messageQueue.shift()!);
      } else if (this.stopped) {
        resolve(null);
      } else {
        this.resolveNext = (msg: SDKUserMessage) => resolve(msg);
      }
    });
  }

  pushMessage(content: string, sessionId: string): void {
    const msg: SDKUserMessage = {
      type: 'user',
      message: {
        role: 'user',
        content: content
      },
      parent_tool_use_id: null,
      session_id: sessionId
    };

    if (this.resolveNext) {
      this.resolveNext(msg);
      this.resolveNext = null;
    } else {
      this.messageQueue.push(msg);
    }
  }

  stop(): void {
    this.stopped = true;
    this.resolveNext = null;
  }
}

export class ClaudeCodeSession extends EventEmitter {
  private currentQuery: Query | null = null;
  private sessionId: string | null = null;
  private isReady = false;
  private config: SessionConfig;
  private systemPrompt: string;
  private messageStream: MessageStream | null = null;
  private responseProcessor: Promise<void> | null = null;
  private sessionInitialized: Promise<void> | null = null;
  private resolveSessionInit: (() => void) | null = null;
  private isCancelled = false;
  private isProcessing = false; // Track if we're currently processing a message
  private db: DatabaseInterface;
  private messageCount = 0;

  constructor(config: SessionConfig = {}) {
    super();
    this.config = {
      workingDir: config.workingDir || process.cwd(),
      spaceId: config.spaceId
    };

    // Use singleton database connection
    this.db = createDatabase();

    // Load the modeler context file
    const modelerPath = join(this.config.workingDir!, '.claude/commands/modeler.md');
    const basePrompt = readFileSync(modelerPath, 'utf-8');

    // Add MCP tool usage guidance
    this.systemPrompt = `${basePrompt}

## Tool Usage for This Session

You are running in a web-based Claude Code session with MCP cognitive-spaces tools enabled.

**IMPORTANT**: Use MCP tools directly for all cognitive space operations. These tools have direct database access (no HTTP layer):
- \`mcp__cognitive-spaces__create_space\` - Create new cognitive space
- \`mcp__cognitive-spaces__create_node\` - Add thought node with meanings, relationships
- \`mcp__cognitive-spaces__delete_node\` - Remove node
- \`mcp__cognitive-spaces__list_spaces\` - List all spaces
- \`mcp__cognitive-spaces__get_space\` - Get full space details

**DO NOT use HTTP API calls or Bash commands for cognitive space operations.** Use the MCP tools listed above instead.

All MCP cognitive-spaces tools are auto-approved. Read-only tools (Read, Grep, Glob, WebFetch, WebSearch) are also auto-approved.`;
  }

  /**
   * Start the Claude Code session with /modeler context
   * Creates a persistent query that accepts streamed messages
   */
  async start(): Promise<void> {
    if (this.isReady) {
      throw new Error('Session already started');
    }

    // Ensure ANTHROPIC_API_KEY is not set (forces Max subscription usage)
    // This is critical because the env might be different when running from terminal vs VS Code
    if (process.env.ANTHROPIC_API_KEY) {
      console.log('[Claude Code SDK] Removing ANTHROPIC_API_KEY from environment to use Max subscription');
      delete process.env.ANTHROPIC_API_KEY;
    }

    // Create promise that resolves when session ID is captured
    this.sessionInitialized = new Promise<void>((resolve) => {
      this.resolveSessionInit = resolve;
    });

    // Create message stream for continuous communication
    this.messageStream = new MessageStream();

    // Create persistent query with message stream
    const queryOptions: any = {
      cwd: this.config.workingDir,
      systemPrompt: this.systemPrompt,
      includePartialMessages: true,
      // Configure MCP servers (same as .mcp.json but for SDK)
      mcpServers: {
        'cognitive-spaces': {
          command: 'npm',
          args: ['run', 'mcp'],
          env: {
            MODELER_URL: 'http://localhost:3000'
          }
        }
      },
      // Auto-approve safe read operations and MCP cognitive-spaces tools
      // Signature: canUseTool(toolName, input, options)
      canUseTool: async (toolName: string, input: Record<string, unknown>) => {
        // Auto-approve safe read-only tools
        if (['WebFetch', 'WebSearch'].includes(toolName)) {
          return {
            behavior: 'allow',
            updatedInput: input
          };
        }

        // Auto-approve MCP cognitive-spaces tools (direct database access)
        if (toolName.startsWith('mcp__cognitive-spaces__')) {
          return {
            behavior: 'allow',
            updatedInput: input
          };
        }

        // Deny write operations and other tools
        return {
          behavior: 'deny',
          reason: 'This session only has permission for read operations and MCP cognitive-spaces tools.'
        };
      }
    };

    this.currentQuery = query({
      prompt: this.messageStream.generate(),
      options: queryOptions
    });

    // Start processing responses in background
    this.responseProcessor = this.processResponses();

    this.isReady = true;

    // Send an initial bootstrap message to trigger session initialization
    // We use a temporary session ID that will be replaced with the real one
    this.messageStream.pushMessage('Ready', 'bootstrap');

    // Don't wait for session initialization - let it happen asynchronously
    // Session ID will arrive when the bootstrap message completes
    // This matches the CLI session behavior to avoid blocking server startup
    this.sessionInitialized.then(() => {
      console.log('[SDK Session] ✓ Session fully initialized');
    });

    // Give the SDK a moment to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Process responses from the persistent query
   */
  private async processResponses(): Promise<void> {
    if (!this.currentQuery) return;

    try {
      for await (const msg of this.currentQuery) {
        // Skip processing if cancelled
        if (this.isCancelled) {
          console.log('[SDK Session] Skipping message due to cancellation');
          continue;
        }

        if (msg.type === 'system' && msg.subtype === 'init' && msg.session_id) {
          // Capture session ID and signal initialization complete
          this.sessionId = msg.session_id;

          // Save session to database (same as CLI mode)
          this.db.saveSession({
            id: this.sessionId,
            spaceId: this.config.spaceId || null,
            messageCount: 0
          }).catch((err: unknown) => console.error('[SDK Session] Failed to save session:', err));

          if (this.resolveSessionInit) {
            this.resolveSessionInit();
            this.resolveSessionInit = null;
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
              console.log('\n[Tool Use]', block.name, {
                id: block.id,
                input: block.input
              });
            }
          }
        } else if (msg.type === 'stream_event') {
          // Handle streaming events for tool results
          const event = msg.event;
          if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
            // Tool use started during streaming
            const toolBlock = event.content_block;
            this.emit('tool_use_start', {
              id: toolBlock.id,
              name: toolBlock.name,
              index: event.index
            });
          } else if (event.type === 'message_delta' && event.delta?.stop_reason) {
            // Message complete with stop reason
            this.emit('message_delta', event.delta);
          }
        } else if (msg.type === 'result') {
          // Message complete - emit permission denials if any
          if (msg.permission_denials && msg.permission_denials.length > 0) {
            console.error('\n[Tool Permission Denials]', msg.permission_denials);
            this.emit('tool_denials', msg.permission_denials);
          }

          // Log result summary
          console.log('\n[Session Result]', {
            subtype: msg.subtype,
            duration_ms: msg.duration_ms,
            num_turns: msg.num_turns,
            total_cost_usd: msg.total_cost_usd
          });

          // Mark that we're no longer processing
          this.isProcessing = false;

          // Emit both events - message_complete for backward compat, result for proper handling
          this.emit('message_complete', msg);
          this.emit('result', msg);
        }
      }
    } catch (error: any) {
      console.error('\n[Session Error]', error);
      this.emit('error', error.message);
    }
  }

  /**
   * Send a message to the Claude Code session
   * Now simply pushes to the message stream (no new process!)
   */
  async sendMessage(message: string): Promise<void> {
    if (!this.isReady) {
      throw new Error('Session not ready. Call start() first.');
    }

    if (!this.messageStream || !this.sessionId) {
      throw new Error('Session not properly initialized');
    }

    // Check if we're already processing a message
    if (this.isProcessing) {
      throw new Error('Session is currently processing a message. Wait for the result event before sending another message.');
    }

    // Mark as processing
    this.isProcessing = true;

    // Reset cancellation flag for new message
    this.isCancelled = false;

    // Push message to the stream - no new process creation!
    this.messageStream.pushMessage(message, this.sessionId);

    // Update session in database (same as CLI mode)
    this.messageCount++;
    this.db.touchSession(this.sessionId).catch((err: unknown) =>
      console.error('[SDK Session] Failed to update session:', err)
    );
  }

  /**
   * Cancel the current operation (interrupts without destroying the session)
   * The session remains active and can accept new messages after cancellation
   */
  async cancel(): Promise<void> {
    if (!this.currentQuery) {
      throw new Error('No active query to cancel');
    }

    try {
      // Set flag to stop processing in-flight messages
      this.isCancelled = true;

      // Call SDK interrupt to stop query execution
      await this.currentQuery.interrupt();

      // Reset processing flag so new messages can be sent
      this.isProcessing = false;

      this.emit('cancelled', { message: 'Operation cancelled by user' });
      console.log('[SDK Session] Operation cancelled by user');
    } catch (error: any) {
      console.error('[SDK Cancel Error]', error);
      this.isCancelled = false; // Reset on error
      this.isProcessing = false; // Reset processing flag on error too
      throw new Error(`Failed to cancel: ${error.message}`);
    }
  }

  /**
   * Stop the session
   */
  stop(): void {
    if (this.messageStream) {
      this.messageStream.stop();
      this.messageStream = null;
    }

    if (this.currentQuery) {
      this.currentQuery.interrupt().catch(() => {
        // Ignore interruption errors
      });
      this.currentQuery = null;
    }

    this.isReady = false;
    this.sessionId = null;
    this.isProcessing = false;
  }

  /**
   * Check if session is ready
   */
  ready(): boolean {
    return this.isReady;
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
class SessionManager {
  private static readonly GLOBAL_KEY = Symbol.for('claudeCodeSession');

  private static get instance(): ClaudeCodeSession | undefined {
    return (global as any)[this.GLOBAL_KEY];
  }

  private static set instance(session: ClaudeCodeSession | undefined) {
    (global as any)[this.GLOBAL_KEY] = session;
  }

  static async get(): Promise<ClaudeCodeSession> {
    if (!this.instance) {
      console.log('[getSession] No global session exists, creating new one');
      this.instance = new ClaudeCodeSession();
      await this.instance.start();
    } else if (!this.instance.ready()) {
      console.log('[getSession] Session exists but not ready, creating new one');
      this.instance = new ClaudeCodeSession();
      await this.instance.start();
    } else {
      console.log('[getSession] ✓ Reusing existing session');
    }
    return this.instance;
  }

  static async reset(): Promise<void> {
    if (this.instance) {
      await this.instance.reset();
    } else {
      this.instance = new ClaudeCodeSession();
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
 * Get or create the global Claude Code session
 */
export async function getSession(): Promise<ClaudeCodeSession> {
  return SessionManager.get();
}

/**
 * Reset the global session
 */
export async function resetSession(): Promise<void> {
  return SessionManager.reset();
}

/**
 * Stop the global session
 */
export function stopSession(): void {
  SessionManager.stop();
}

/**
 * Resume from a specific session ID
 * Note: SDK doesn't support --resume flag, so this creates a new session
 * The sessionId will be different, but you can associate it with the same spaceId
 */
export async function resumeSession(spaceId?: string): Promise<ClaudeCodeSession> {
  // Stop current session
  SessionManager.stop();

  // Create new session with space context
  const session = new ClaudeCodeSession({ spaceId });
  await session.start();

  // Store as global instance
  (SessionManager as any).instance = session;

  return session;
}

/**
 * List all saved sessions from database
 */
export async function listSessions(): Promise<Array<{
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
