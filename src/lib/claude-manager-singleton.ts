/**
 * Claude Manager Singleton
 *
 * Uses ClaudeManager from @fronx/use-claude-code/server as the session engine.
 * Provides a ReadableStreamAdapter to bridge ServerResponse-based SSE to Next.js ReadableStream.
 *
 * Fixes the listener leak bug: the library auto-removes subscribers when the
 * HTTP connection closes (res.on('close', ...)), so no manual cleanup is needed.
 */

import { ClaudeManager } from '@fronx/use-claude-code/server';
import { EventEmitter } from 'events';
import { join } from 'path';
import { readFileSync } from 'fs';
import type { ServerResponse } from 'http';

// ---------- Singleton ClaudeManager ----------

const GLOBAL_KEY = Symbol.for('modeler.claudeManager');

export function getClaudeManager(): ClaudeManager {
  if (!(global as any)[GLOBAL_KEY]) {
    (global as any)[GLOBAL_KEY] = new ClaudeManager({
      sessionDir: join(process.cwd(), '.claude/sessions'),
    });
  }
  return (global as any)[GLOBAL_KEY];
}

// ---------- Allowed tools ----------

export const ALLOWED_TOOLS = [
  'mcp__cognitive-spaces__create_space',
  'mcp__cognitive-spaces__create_node',
  'mcp__cognitive-spaces__delete_node',
  'mcp__cognitive-spaces__list_spaces',
  'mcp__cognitive-spaces__get_space',
  'mcp__cognitive-spaces__create_edge',
  'mcp__cognitive-spaces__delete_edge',
  'WebFetch',
  'WebSearch',
];

// ---------- System prompt ----------

let cachedSystemPrompt: string | null = null;

export function getSystemPrompt(): string {
  if (!cachedSystemPrompt) {
    const modelerPath = join(process.cwd(), '.claude/commands/modeler.md');
    cachedSystemPrompt = readFileSync(modelerPath, 'utf-8');
  }
  return cachedSystemPrompt;
}

// ---------- Start options helper ----------

export function getStartOptions() {
  return {
    systemPrompt: getSystemPrompt(),
    cwd: process.cwd(),
    allowedTools: ALLOWED_TOOLS,
  };
}

// ---------- ReadableStreamAdapter ----------

/**
 * Bridges ClaudeManager's ServerResponse-based SSE to a Next.js ReadableStream.
 *
 * The library calls sendSSE(res, event, data), which does:
 *   res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
 *
 * This adapter intercepts those writes, translates the library's event format
 * into the existing frontend format, and enqueues them on a ReadableStreamDefaultController.
 *
 * When destroy() is called, it emits 'close' — the library auto-removes
 * this adapter from activeStreams via the close listener it registers.
 */
export class ReadableStreamAdapter extends EventEmitter {
  private controller: ReadableStreamDefaultController;
  private encoder = new TextEncoder();
  destroyed = false;

  constructor(controller: ReadableStreamDefaultController) {
    super();
    this.controller = controller;
  }

  /**
   * Intercept SSE writes from the library.
   * Format: `event: <type>\ndata: <json>\n\n`
   */
  write(chunk: string | Buffer): boolean {
    if (this.destroyed) return false;

    const str = typeof chunk === 'string' ? chunk : chunk.toString();

    // Parse SSE format
    const eventMatch = str.match(/^event: (\w+)\ndata: (.+)\n\n$/s);
    if (!eventMatch) return true;

    const [, eventType, dataStr] = eventMatch;
    let data: any;
    try {
      data = JSON.parse(dataStr);
    } catch {
      return true;
    }

    this.translateEvent(eventType, data);
    return true;
  }

  private translateEvent(eventType: string, data: any): void {
    switch (eventType) {
      case 'assistant':
        this.send({ content: data.text });
        break;

      case 'tool':
        this.send({
          type: 'tool_use',
          tool_use: { name: data.name, input: data.input },
        });
        break;

      case 'result':
        this.send({ type: 'result', result: data.result });
        this.sendRaw('[DONE]');
        this.destroy();
        break;

      case 'error':
        this.send({ error: data.message || 'Unknown error' });
        break;

      case 'closed':
      case 'stopped':
        this.sendRaw('[DONE]');
        this.destroy();
        break;

      // init, history, user, cleared — ignore
    }
  }

  private send(obj: any): void {
    if (!this.destroyed) {
      this.controller.enqueue(
        this.encoder.encode(`data: ${JSON.stringify(obj)}\n\n`),
      );
    }
  }

  private sendRaw(text: string): void {
    if (!this.destroyed) {
      this.controller.enqueue(this.encoder.encode(`data: ${text}\n\n`));
    }
  }

  // No-ops for ServerResponse compatibility
  setHeader(): void {}
  writeHead(): void {}
  end(): void {
    this.destroy();
  }

  destroy(): ReadableStreamAdapter {
    if (this.destroyed) return this;
    this.destroyed = true;
    try {
      this.controller.close();
    } catch {
      // Controller may already be closed
    }
    this.emit('close');
    return this;
  }
}

// Type assertion helper — the adapter implements enough of ServerResponse
// for subscribe()/unsubscribe()/sendSSE() to work.
export function asServerResponse(adapter: ReadableStreamAdapter): ServerResponse {
  return adapter as unknown as ServerResponse;
}
