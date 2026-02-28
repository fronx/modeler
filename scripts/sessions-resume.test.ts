/**
 * Regression test for the "Resume Past Session" bug.
 *
 * Bug: The resume route called manager.clear('modeler') before manager.resume('modeler', ...).
 * clear() deletes the persisted session file, so resume() immediately threw
 * "No persisted session found for conversation modeler".
 *
 * Run with: npx tsx scripts/sessions-resume.test.ts
 */

// Direct dist import: tsx runs in CJS mode but this package only exports ESM
import { ClaudeManager } from '../node_modules/@fronx/use-claude-code/dist/server/index.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (err: any) {
    console.error(`  FAIL  ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

const MOCK_SESSION = {
  sessionId: 'test-session-id',
  claudeSessionId: 'claude-abc123',
  messages: [],
  createdAt: new Date().toISOString(),
  lastMessageAt: new Date().toISOString(),
};

const START_OPTIONS = {
  systemPrompt: 'You are a test assistant.',
  cwd: process.cwd(),
  allowedTools: [] as string[],
};

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'modeler-resume-'));
const sessionPath = path.join(tmpDir, 'modeler.json');

try {
  console.log('sessions resume regression tests\n');

  test('clear() deletes the persisted session file', () => {
    fs.writeFileSync(sessionPath, JSON.stringify(MOCK_SESSION));
    const manager = new ClaudeManager({ sessionDir: tmpDir });

    assert(manager.hasPersistedSession('modeler'), 'session should exist before clear');
    manager.clear('modeler');
    assert(!manager.hasPersistedSession('modeler'), 'session should be gone after clear');
  });

  test('clear() before resume() throws "No persisted session found" (the bug)', () => {
    fs.writeFileSync(sessionPath, JSON.stringify(MOCK_SESSION));
    const manager = new ClaudeManager({ sessionDir: tmpDir });

    manager.clear('modeler');

    try {
      manager.resume('modeler', START_OPTIONS);
      throw new Error('Expected resume to throw');
    } catch (err: any) {
      assert(
        err.message.includes('No persisted session found'),
        `Expected "No persisted session found", got: ${err.message}`,
      );
    }
  });

  test('without clear(), session persists and resume() can find it', () => {
    fs.writeFileSync(sessionPath, JSON.stringify(MOCK_SESSION));
    const manager = new ClaudeManager({ sessionDir: tmpDir });

    // The fix: just call resume() directly without clear().
    // We verify the session is available rather than spawning Claude.
    assert(manager.hasPersistedSession('modeler'), 'session should be available for resume');
  });

  console.log('\nDone.');
} finally {
  fs.rmSync(tmpDir, { recursive: true });
}
