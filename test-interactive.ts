#!/usr/bin/env node
/**
 * Interactive CLI client for testing Claude Code session
 *
 * Usage: npx tsx test-interactive.ts
 */

import * as readline from 'readline';
import { ClaudeCodeSession } from './src/lib/claude-code-session';

const session = new ClaudeCodeSession();

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '\n> '
});

// Handle session responses
session.on('data', (data: string) => {
  // Write response chunks as they arrive
  process.stdout.write(data);
});

session.on('message_complete', (result: any) => {
  // Message complete - show prompt again
  console.log('\n');
  if (result.duration_ms) {
    console.log(`[Response time: ${result.duration_ms}ms]`);
  }
  rl.prompt();
});

session.on('error', (error: string) => {
  console.error('\n[Error]:', error);
  rl.prompt();
});

// Handle user input
rl.on('line', async (line: string) => {
  const input = line.trim();

  if (!input) {
    rl.prompt();
    return;
  }

  // Handle special commands
  if (input === '/exit' || input === '/quit') {
    console.log('Stopping session...');
    session.stop();
    rl.close();
    process.exit(0);
  }

  if (input === '/reset') {
    console.log('Resetting session...');
    await session.reset();
    rl.prompt();
    return;
  }

  if (input === '/help') {
    console.log('\nCommands:');
    console.log('  /exit, /quit  - Exit the interactive session');
    console.log('  /reset        - Reset the Claude Code session');
    console.log('  /help         - Show this help message');
    console.log('\nJust type your message to chat with Claude Code.\n');
    rl.prompt();
    return;
  }

  // Send message to Claude Code
  try {
    await session.sendMessage(input);
  } catch (error: any) {
    console.error('\n[Error sending message]:', error.message);
    rl.prompt();
  }
});

rl.on('close', () => {
  console.log('\nGoodbye!');
  session.stop();
  process.exit(0);
});

// Start the session
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Claude Code Interactive Session                           ║');
  console.log('║  Type /help for commands, /exit to quit                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    console.log('\nStarting session...');
    await session.start();
    console.log('Session ready! Type your message below.\n');
    rl.prompt();
  } catch (error: any) {
    console.error('Failed to start session:', error.message);
    process.exit(1);
  }
}

main();
