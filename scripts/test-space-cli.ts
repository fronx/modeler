#!/usr/bin/env node
/**
 * Test suite for space-cli.ts
 *
 * This script tests all major CLI commands to ensure they work correctly.
 * Run with: npx tsx scripts/test-space-cli.ts
 */

import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';

const TEST_DB = 'test-cli.db';
const CLI_CMD = 'npx tsx scripts/space-cli.ts';

// Use test database for all commands
const env = { ...process.env, DATABASE_TYPE: 'turso', TURSO_DATABASE_URL: `file:${TEST_DB}` };

let testsPassed = 0;
let testsFailed = 0;
let createdSpaceId: string | null = null;

function runCommand(cmd: string): { stdout: string; success: boolean } {
  try {
    const stdout = execSync(`${CLI_CMD} ${cmd}`, {
      env,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { stdout, success: true };
  } catch (error: any) {
    return { stdout: error.stdout || '', success: false };
  }
}

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
    testsPassed++;
  } catch (error: any) {
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error.message}`);
    testsFailed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseJSON(str: string): any {
  try {
    return JSON.parse(str.trim());
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${str}`);
  }
}

console.log('\n=== Testing Space CLI ===\n');

// Clean up test database if it exists
if (existsSync(TEST_DB)) {
  unlinkSync(TEST_DB);
  console.log('Cleaned up existing test database\n');
}

// Test 1: List empty spaces
test('list (empty)', () => {
  const result = runCommand('list');
  assert(result.success, 'Command should succeed');
  assert(result.stdout.trim() === '', 'Should return empty output');
});

// Test 2: List with JSON format
test('list --json (empty)', () => {
  const result = runCommand('list --json');
  assert(result.success, 'Command should succeed');
  const data = parseJSON(result.stdout);
  assert(Array.isArray(data), 'Should return an array');
  assert(data.length === 0, 'Array should be empty');
});

// Test 3: Create a space
test('create space', () => {
  const result = runCommand('create "Test Space" "A test space for CLI testing"');
  assert(result.success, 'Command should succeed');
  const data = parseJSON(result.stdout);
  assert(data.id, 'Should return space ID');
  assert(typeof data.id === 'string', 'ID should be a string');
  createdSpaceId = data.id;
});

// Test 4: List spaces (should have 1)
test('list (with space)', () => {
  const result = runCommand('list');
  assert(result.success, 'Command should succeed');
  assert(result.stdout.includes(createdSpaceId!), 'Should include created space ID');
  assert(result.stdout.includes('Test Space'), 'Should include space title');
});

// Test 5: Get space
test('get space', () => {
  const result = runCommand(`get ${createdSpaceId}`);
  assert(result.success, 'Command should succeed');
  const data = parseJSON(result.stdout);
  assert(data.metadata, 'Should have metadata');
  assert(data.metadata.id === createdSpaceId, 'Should match space ID');
  assert(data.metadata.title === 'Test Space', 'Should match title');
  assert(data.nodes, 'Should have nodes object');
  assert(Object.keys(data.nodes).length === 0, 'Should have no nodes');
});

// Test 6: Get nodes only
test('get --nodes-only', () => {
  const result = runCommand(`get ${createdSpaceId} --nodes-only`);
  assert(result.success, 'Command should succeed');
  const data = parseJSON(result.stdout);
  assert(typeof data === 'object', 'Should be an object');
  assert(Object.keys(data).length === 0, 'Should be empty');
});

// Test 7: Analyze empty space
test('analyze (empty space)', () => {
  const result = runCommand(`analyze ${createdSpaceId}`);
  assert(result.success, 'Command should succeed');
  const data = parseJSON(result.stdout);
  assert(data.totalNodes === 0, 'Should have 0 nodes');
  assert(data.focusLevels, 'Should have focus levels');
  assert(data.relationships, 'Should have relationships array');
  assert(data.branchedNodes, 'Should have branched nodes array');
});

// Test 8: Add node with explicit ID
test('add-node (explicit ID)', () => {
  const result = runCommand(`add-node ${createdSpaceId} "Research" -m "Gather information" -f 1.0 -p -0.5`);
  assert(result.success, 'Command should succeed');
  const data = parseJSON(result.stdout);
  assert(data.success === true, 'Should indicate success');
  assert(data.nodeId === 'Research', 'Should return correct node ID');
});

// Test 9: Add node with auto-generated ID
test('add-node (auto-generated ID)', () => {
  const result = runCommand(`add-node ${createdSpaceId} -m "Build the prototype" -f 1.0`);
  assert(result.success, 'Command should succeed');
  const data = parseJSON(result.stdout);
  assert(data.success === true, 'Should indicate success');
  assert(data.nodeId === 'BuildThePrototype', 'Should auto-generate PascalCase ID');
});

// Test 10: Add node with relationship
test('add-node (with relationship)', () => {
  const result = runCommand(`add-node ${createdSpaceId} "Testing" -m "Verify functionality" -f 1.0 -r "Research:supports:0.8"`);
  assert(result.success, 'Command should succeed');
  const data = parseJSON(result.stdout);
  assert(data.success === true, 'Should indicate success');
  assert(data.nodeId === 'Testing', 'Should return correct node ID');
});

// Test 11: Add node with checkable list
test('add-node (with checkable list)', () => {
  const result = runCommand(`add-node ${createdSpaceId} "Tasks" -m "Things to do" --checkable "Write tests" --checkable "Run tests"`);
  assert(result.success, 'Command should succeed');
  const data = parseJSON(result.stdout);
  assert(data.success === true, 'Should indicate success');
});

// Test 12: Analyze space with nodes
test('analyze (with nodes)', () => {
  const result = runCommand(`analyze ${createdSpaceId}`);
  assert(result.success, 'Command should succeed');
  const data = parseJSON(result.stdout);
  assert(data.totalNodes === 4, 'Should have 4 nodes');
  assert(data.focusLevels.visible.length === 4, 'All nodes should be visible');
  assert(data.relationships.length === 1, 'Should have 1 relationship');
});

// Test 13: Update node (add meaning)
test('update-node (add meaning)', () => {
  const result = runCommand(`update-node ${createdSpaceId} "Research" -m "Additional research needed"`);
  assert(result.success, 'Command should succeed');
  const data = parseJSON(result.stdout);
  assert(data.success === true, 'Should indicate success');
  assert(data.nodeId === 'Research', 'Should return correct node ID');
});

// Test 14: Update node (change focus)
test('update-node (change focus)', () => {
  const result = runCommand(`update-node ${createdSpaceId} "Research" -f -1.0`);
  assert(result.success, 'Command should succeed');
  const data = parseJSON(result.stdout);
  assert(data.success === true, 'Should indicate success');
});

// Test 15: Analyze after focus change
test('analyze (after focus change)', () => {
  const result = runCommand(`analyze ${createdSpaceId}`);
  assert(result.success, 'Command should succeed');
  const data = parseJSON(result.stdout);
  assert(data.focusLevels.visible.length === 3, 'Should have 3 visible nodes');
  assert(data.focusLevels.hidden.length === 1, 'Should have 1 hidden node');
  assert(data.focusLevels.hidden.includes('Research'), 'Research should be hidden');
});

// Test 16: Patch space
test('patch space', () => {
  const patch = JSON.stringify({
    nodes: {
      "Deployment": {
        meanings: [{ content: "Deploy to production", confidence: 0.9, timestamp: Date.now() }],
        focus: 1.0,
        semanticPosition: 0.5
      }
    }
  });
  const result = runCommand(`patch ${createdSpaceId} '${patch}'`);
  assert(result.success, 'Command should succeed');
  const data = parseJSON(result.stdout);
  assert(data.success === true, 'Should indicate success');
});

// Test 17: Verify patch
test('get space (after patch)', () => {
  const result = runCommand(`get ${createdSpaceId}`);
  assert(result.success, 'Command should succeed');
  const data = parseJSON(result.stdout);
  assert(data.nodes.Deployment, 'Should have Deployment node');
  assert(Object.keys(data.nodes).length === 5, 'Should have 5 nodes');
});

// Test 18: Debug mode
test('add-node --debug', () => {
  const result = runCommand(`--debug add-node ${createdSpaceId} "Monitoring" -m "Track system health"`);
  assert(result.success, 'Command should succeed');
  const data = parseJSON(result.stdout);
  assert(data.spaceId, 'Debug mode should include spaceId');
  assert(data.node, 'Debug mode should include full node data');
  assert(data.node.meanings, 'Debug mode should include meanings');
});

// Test 19: Create second space
test('create second space', () => {
  const result = runCommand('create "Second Space" "Another test space"');
  assert(result.success, 'Command should succeed');
  const data = parseJSON(result.stdout);
  assert(data.id, 'Should return space ID');
  assert(data.id !== createdSpaceId, 'Should have different ID');
});

// Test 20: List multiple spaces
test('list (multiple spaces)', () => {
  const result = runCommand('list');
  assert(result.success, 'Command should succeed');
  const lines = result.stdout.trim().split('\n');
  assert(lines.length === 2, 'Should have 2 spaces');
});

// Test 21: Delete space
test('delete space', () => {
  const result = runCommand(`delete ${createdSpaceId}`);
  assert(result.success, 'Command should succeed');
  const data = parseJSON(result.stdout);
  assert(data.success === true, 'Should indicate success');
  assert(data.deleted === createdSpaceId, 'Should return deleted space ID');
});

// Test 22: Verify deletion
test('list (after delete)', () => {
  const result = runCommand('list');
  assert(result.success, 'Command should succeed');
  const lines = result.stdout.trim().split('\n');
  assert(lines.length === 1, 'Should have 1 space');
  assert(!result.stdout.includes(createdSpaceId!), 'Should not include deleted space');
});

// Test 23: Get non-existent space
test('get (non-existent)', () => {
  const result = runCommand('get non-existent-id');
  assert(!result.success, 'Command should fail');
  assert(result.stdout.includes('not found'), 'Should indicate space not found');
});

// Summary
console.log('\n=== Test Results ===\n');
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log(`Total:  ${testsPassed + testsFailed}\n`);

// Cleanup
if (existsSync(TEST_DB)) {
  unlinkSync(TEST_DB);
  console.log('Cleaned up test database\n');
}

process.exit(testsFailed > 0 ? 1 : 0);
