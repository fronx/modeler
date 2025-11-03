/**
 * Tests for space-cli.ts
 *
 * IMPORTANT: Stop the dev server before running tests to avoid database locks.
 * Run with: npx tsx scripts/space-cli.test.ts
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runCLI(command: string): Promise<{ stdout: string; stderr: string }> {
  return await execAsync(`npx tsx scripts/space-cli.ts ${command}`);
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(error);
    process.exit(1);
  }
}

let testSpaceId: string;
const testTitle = `Test Space ${Date.now()}`;

async function main() {
  console.log('Running space-cli tests...\n');

  await test('create space', async () => {
    const { stdout } = await runCLI(`create "${testTitle}" "Test description"`);
    const result = JSON.parse(stdout);
    if (!result.id) throw new Error('No ID returned');
    testSpaceId = result.id;
  });

  await test('list spaces', async () => {
    const { stdout } = await runCLI('list');
    if (!stdout.includes(testTitle)) {
      throw new Error('Created space not found in list');
    }
  });

  await test('get space by ID', async () => {
    const { stdout } = await runCLI(`get ${testSpaceId}`);
    const space = JSON.parse(stdout);
    if (space.metadata.title !== testTitle) {
      throw new Error('Space title mismatch');
    }
  });

  await test('get space by title', async () => {
    const { stdout } = await runCLI(`get "${testTitle}"`);
    const space = JSON.parse(stdout);
    if (space.metadata.id !== testSpaceId) {
      throw new Error('Space ID mismatch when fetching by title');
    }
  });

  await test('add visible node by title', async () => {
    const { stdout } = await runCLI(
      `add-node "${testTitle}" --title "Test Node" --body "Test content" --focus 1.0`
    );
    const result = JSON.parse(stdout);
    if (!result.success || result.nodeId !== 'TestNode') {
      throw new Error('Failed to add node by title');
    }
  });

  await test('add conflicting node with relationship', async () => {
    const { stdout } = await runCLI(
      `add-node "${testTitle}" --title "Opposing View" --body "Alternative perspective" --focus 1.0 --relates-to "TestNode:conflicts-with:0.8"`
    );
    const result = JSON.parse(stdout);
    if (!result.success || result.nodeId !== 'OpposingView') {
      throw new Error('Failed to add conflicting node');
    }
  });

  await test('add supporting node with relationship', async () => {
    const { stdout } = await runCLI(
      `add-node "${testTitle}" --title "Supporting Evidence" --body "Backing data" --focus 1.0 --relates-to "TestNode:supports:0.9"`
    );
    const result = JSON.parse(stdout);
    if (!result.success || result.nodeId !== 'SupportingEvidence') {
      throw new Error('Failed to add supporting node');
    }
  });

  await test('add hidden context node', async () => {
    const { stdout } = await runCLI(
      `add-node "${testTitle}" --title "Background Context" --body "Hidden information" --focus -1.0 --relates-to "TestNode:supports:0.7"`
    );
    const result = JSON.parse(stdout);
    if (!result.success || result.nodeId !== 'BackgroundContext') {
      throw new Error('Failed to add hidden node');
    }
  });

  await test('update node by title', async () => {
    const { stdout } = await runCLI(
      `update-node "${testTitle}" "TestNode" --meaning "Updated meaning"`
    );
    const result = JSON.parse(stdout);
    if (!result.success) {
      throw new Error('Failed to update node by title');
    }
  });

  await test('analyze space structure', async () => {
    const { stdout } = await runCLI(`analyze "${testTitle}"`);
    const analysis = JSON.parse(stdout);

    if (analysis.totalNodes !== 4) {
      throw new Error(`Expected 4 nodes, got ${analysis.totalNodes}`);
    }

    if (analysis.focusLevels.visible.length !== 3) {
      throw new Error(`Expected 3 visible nodes, got ${analysis.focusLevels.visible.length}`);
    }

    if (analysis.focusLevels.hidden.length !== 1) {
      throw new Error(`Expected 1 hidden node, got ${analysis.focusLevels.hidden.length}`);
    }

    if (analysis.relationships.length !== 3) {
      throw new Error(`Expected 3 relationships, got ${analysis.relationships.length}`);
    }

    // Verify conflict relationship exists
    const conflictRel = analysis.relationships.find(
      (r: any) => r.type === 'conflicts-with' && r.strength === 0.8
    );
    if (!conflictRel) {
      throw new Error('Conflict relationship not found');
    }

    // Verify support relationships exist
    const supportRels = analysis.relationships.filter(
      (r: any) => r.type === 'supports'
    );
    if (supportRels.length !== 2) {
      throw new Error(`Expected 2 support relationships, got ${supportRels.length}`);
    }
  });

  await test('get nodes only by title', async () => {
    const { stdout } = await runCLI(`get "${testTitle}" --nodes-only`);
    const nodes = JSON.parse(stdout);
    if (!nodes.TestNode) {
      throw new Error('Failed to get nodes by title');
    }
    // Verify all 4 nodes are present
    if (Object.keys(nodes).length !== 4) {
      throw new Error(`Expected 4 nodes, got ${Object.keys(nodes).length}`);
    }
  });

  await test('add node with checkable list', async () => {
    const { stdout } = await runCLI(
      `add-node "${testTitle}" --title "Task List" --checkable "Task 1" --checkable "Task 2" --focus 1.0`
    );
    const result = JSON.parse(stdout);
    if (!result.success || result.nodeId !== 'TaskList') {
      throw new Error('Failed to add node with checkable list');
    }
  });

  await test('verify checkable list in nodes', async () => {
    const { stdout } = await runCLI(`get "${testTitle}" --nodes-only`);
    const nodes = JSON.parse(stdout);
    const taskList = nodes.TaskList;
    if (!taskList.checkableList || taskList.checkableList.length !== 2) {
      throw new Error('Checkable list not properly stored');
    }
    if (taskList.checkableList[0].item !== 'Task 1') {
      throw new Error('Checkable list item mismatch');
    }
  });

  await test('add node with values', async () => {
    const { stdout } = await runCLI(
      `add-node "${testTitle}" --title "Metrics" --values '{"count": 42, "score": 0.95}' --focus 0.0`
    );
    const result = JSON.parse(stdout);
    if (!result.success || result.nodeId !== 'Metrics') {
      throw new Error('Failed to add node with values');
    }
  });

  await test('verify values in nodes', async () => {
    const { stdout } = await runCLI(`get "${testTitle}" --nodes-only`);
    const nodes = JSON.parse(stdout);
    const metrics = nodes.Metrics;
    if (!metrics.values || metrics.values.count !== 42 || metrics.values.score !== 0.95) {
      throw new Error('Values not properly stored');
    }
  });

  await test('update node to add relationship', async () => {
    const { stdout } = await runCLI(
      `update-node "${testTitle}" "Metrics" --relates-to "TestNode:supports:0.6"`
    );
    const result = JSON.parse(stdout);
    if (!result.success) {
      throw new Error('Failed to add relationship via update');
    }
  });

  await test('verify final analysis with all features', async () => {
    const { stdout } = await runCLI(`analyze "${testTitle}"`);
    const analysis = JSON.parse(stdout);

    // Should now have 6 nodes total
    if (analysis.totalNodes !== 6) {
      throw new Error(`Expected 6 nodes, got ${analysis.totalNodes}`);
    }

    // Should have 4 relationships now
    if (analysis.relationships.length !== 4) {
      throw new Error(`Expected 4 relationships, got ${analysis.relationships.length}`);
    }

    // Verify focus distribution: 4 visible, 1 neutral (Metrics), 1 hidden
    if (analysis.focusLevels.visible.length !== 4) {
      throw new Error(`Expected 4 visible nodes, got ${analysis.focusLevels.visible.length}`);
    }
    if (analysis.focusLevels.neutral.length !== 1) {
      throw new Error(`Expected 1 neutral node, got ${analysis.focusLevels.neutral.length}`);
    }
    if (analysis.focusLevels.hidden.length !== 1) {
      throw new Error(`Expected 1 hidden node, got ${analysis.focusLevels.hidden.length}`);
    }
  });

  await test('delete space by title', async () => {
    const { stdout } = await runCLI(`delete "${testTitle}"`);
    const result = JSON.parse(stdout);
    if (!result.success) {
      throw new Error('Failed to delete space by title');
    }
  });

  await test('verify deletion', async () => {
    const { stdout } = await runCLI('list');
    if (stdout.includes(testTitle)) {
      throw new Error('Space still exists after deletion');
    }
  });

  await test('verify error on non-existent space', async () => {
    try {
      await runCLI(`get "NonExistent Space"`);
      throw new Error('Should have failed for non-existent space');
    } catch (error: any) {
      if (!error.stderr.includes('Space not found')) {
        throw new Error('Expected "Space not found" error message');
      }
    }
  });

  console.log('\n✓ All tests passed!');
}

main().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
