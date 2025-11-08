#!/usr/bin/env npx tsx
/**
 * Test session resume functionality
 * Usage: npx tsx test-session-resume.ts <session-id>
 */

import { TursoDatabase } from './src/lib/turso-database';
import { resumeCLISession } from './src/lib/claude-cli-session';

const sessionId = process.argv[2] || '2f708c6a-a3f2-4d5b-b7dd-d7897c7b4f29';

async function testSessionResume() {
  console.log(`Testing session resume with ID: ${sessionId}\n`);

  const db = new TursoDatabase();

  // First, save the session to database (if it doesn't exist)
  console.log('Saving session to database...');
  await db.saveSession({
    id: sessionId,
    messageCount: 0,
    spaceId: undefined
  });

  // List all sessions
  console.log('\nListing all sessions:');
  const sessions = await db.listSessions();
  console.log(`Found ${sessions.length} session(s):`);
  sessions.forEach(s => {
    console.log(`  - ${s.id} (${s.messageCount} messages, last used: ${new Date(s.lastUsedAt).toLocaleString()})`);
  });

  // Test resuming the session
  console.log(`\nAttempting to resume session: ${sessionId}`);
  try {
    const session = await resumeCLISession(sessionId);
    console.log('✓ Session resumed successfully!');
    console.log(`  Session ID: ${session.getSessionId()}`);
    console.log(`  Ready: ${session.ready()}`);

    // Send a test message
    console.log('\nSending test message...');
    session.on('data', (text) => {
      process.stdout.write(text);
    });

    session.on('message_complete', () => {
      console.log('\n\n✓ Message complete!');
      process.exit(0);
    });

    await session.sendMessage('Hello! Can you confirm this is a resumed session?');
  } catch (error) {
    console.error('✗ Failed to resume session:', error);
    process.exit(1);
  }
}

testSessionResume().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
