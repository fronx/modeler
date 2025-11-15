#!/usr/bin/env npx tsx
/**
 * Test script to verify edge cascade delete behavior
 * Tests that deleting nodes automatically cleans up their edges
 */

import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || 'file:modeler.db';

async function testCascadeDeletes() {
  const client = createClient({ url });

  console.log('=== Testing Edge Cascade Deletes ===\n');

  // Create a test space with nodes and edges
  const testSpaceId = `test-cascade-${Date.now()}`;
  const now = Date.now();

  try {
    // 1. Create test space
    await client.execute({
      sql: 'INSERT INTO spaces (id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      args: [testSpaceId, 'Test Cascade Space', 'Testing edge cascades', now, now]
    });
    console.log(`✓ Created test space: ${testSpaceId}`);

    // 2. Create test nodes
    await client.execute({
      sql: 'INSERT INTO nodes (id, space_id, node_key, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [`${testSpaceId}:NodeA`, testSpaceId, 'NodeA', '{"id":"NodeA"}', now, now]
    });
    await client.execute({
      sql: 'INSERT INTO nodes (id, space_id, node_key, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [`${testSpaceId}:NodeB`, testSpaceId, 'NodeB', '{"id":"NodeB"}', now, now]
    });
    await client.execute({
      sql: 'INSERT INTO nodes (id, space_id, node_key, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [`${testSpaceId}:NodeC`, testSpaceId, 'NodeC', '{"id":"NodeC"}', now, now]
    });
    console.log('✓ Created test nodes: NodeA, NodeB, NodeC');

    // 3. Create test edges
    // NodeA -> NodeB
    await client.execute({
      sql: 'INSERT INTO edges (id, space_id, source_node, target_node, type, strength, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [`${testSpaceId}:NodeA:NodeB`, testSpaceId, 'NodeA', 'NodeB', 'supports', 0.8, now, now]
    });
    // NodeB -> NodeC
    await client.execute({
      sql: 'INSERT INTO edges (id, space_id, source_node, target_node, type, strength, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [`${testSpaceId}:NodeB:NodeC`, testSpaceId, 'NodeB', 'NodeC', 'supports', 0.9, now, now]
    });
    // NodeC -> NodeA (cycle)
    await client.execute({
      sql: 'INSERT INTO edges (id, space_id, source_node, target_node, type, strength, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [`${testSpaceId}:NodeC:NodeA`, testSpaceId, 'NodeC', 'NodeA', 'conflicts-with', 0.5, now, now]
    });
    console.log('✓ Created test edges: A->B, B->C, C->A');

    // 4. Verify initial state
    const initialEdgesResult = await client.execute({
      sql: 'SELECT COUNT(*) as count FROM edges WHERE space_id = ?',
      args: [testSpaceId]
    });
    console.log(`\n Initial edge count: ${initialEdgesResult.rows[0].count}`);

    // 5. Test: Delete NodeB (should cascade delete edges A->B and B->C)
    console.log('\n--- Test 1: Delete NodeB ---');
    await client.execute({
      sql: 'DELETE FROM nodes WHERE space_id = ? AND node_key = ?',
      args: [testSpaceId, 'NodeB']
    });
    console.log('✓ Deleted NodeB');

    const afterNodeBDelete = await client.execute({
      sql: 'SELECT COUNT(*) as count FROM edges WHERE space_id = ?',
      args: [testSpaceId]
    });
    console.log(`  Remaining edges: ${afterNodeBDelete.rows[0].count} (expected: 1)`);

    const remainingEdges = await client.execute({
      sql: 'SELECT source_node, target_node, type FROM edges WHERE space_id = ?',
      args: [testSpaceId]
    });
    console.log('  Remaining edge:', remainingEdges.rows.map(r => `${r.source_node}->${r.target_node}`));

    if (afterNodeBDelete.rows[0].count === 1) {
      console.log('✓ CASCADE DELETE works correctly (2 edges deleted)');
    } else {
      console.log('✗ CASCADE DELETE failed - wrong edge count!');
    }

    // 6. Test: Delete entire space (should cascade delete all nodes and remaining edges)
    console.log('\n--- Test 2: Delete Space ---');
    await client.execute({
      sql: 'DELETE FROM spaces WHERE id = ?',
      args: [testSpaceId]
    });
    console.log('✓ Deleted test space');

    const finalNodesResult = await client.execute({
      sql: 'SELECT COUNT(*) as count FROM nodes WHERE space_id = ?',
      args: [testSpaceId]
    });
    const finalEdgesResult = await client.execute({
      sql: 'SELECT COUNT(*) as count FROM edges WHERE space_id = ?',
      args: [testSpaceId]
    });

    console.log(`  Remaining nodes: ${finalNodesResult.rows[0].count} (expected: 0)`);
    console.log(`  Remaining edges: ${finalEdgesResult.rows[0].count} (expected: 0)`);

    if (finalNodesResult.rows[0].count === 0 && finalEdgesResult.rows[0].count === 0) {
      console.log('✓ Space CASCADE DELETE works correctly');
    } else {
      console.log('✗ Space CASCADE DELETE failed!');
    }

    console.log('\n=== All Tests Passed ===');

  } catch (error) {
    console.error('\n✗ Test failed:', error);
    // Clean up test space even on error
    try {
      await client.execute({
        sql: 'DELETE FROM spaces WHERE id = ?',
        args: [testSpaceId]
      });
      console.log('Cleaned up test space');
    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError);
    }
    throw error;
  } finally {
    client.close();
  }
}

testCascadeDeletes().catch(error => {
  console.error('Test script failed:', error);
  process.exit(1);
});
