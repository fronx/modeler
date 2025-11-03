#!/usr/bin/env npx tsx

/**
 * Test script for Turso database implementation
 *
 * Usage: npx tsx test-turso.ts
 */

import { TursoDatabase } from './src/lib/turso-database';
import type { CognitiveSpace } from './src/lib/turso-database';

async function runTests() {
  console.log('🧪 Testing Turso Database Implementation\n');

  const db = new TursoDatabase({
    url: 'file:test-modeler.db'  // Use local file for testing
  });

  try {
    // Test 1: Create a space
    console.log('Test 1: Creating a new space...');
    const testSpace: CognitiveSpace = {
      metadata: {
        id: 'test-space-' + Date.now(),
        title: 'Test Cognitive Space',
        description: 'A test space to verify Turso integration',
        createdAt: Date.now()
      },
      nodes: {
        'TestNode1': {
          id: 'TestNode1',
          meanings: [
            { content: 'First test node', confidence: 0.9, timestamp: Date.now() }
          ],
          values: { importance: 0.8, complexity: 0.5 },
          relationships: [],
          history: ['Node created']
        },
        'TestNode2': {
          id: 'TestNode2',
          meanings: [
            { content: 'Second test node', confidence: 0.85, timestamp: Date.now() }
          ],
          values: { importance: 0.7, complexity: 0.3 },
          relationships: [],
          history: ['Node created', 'Connected to TestNode1']
        }
      },
      globalHistory: [
        'Space initialized',
        'TestNode1 created',
        'TestNode2 created'
      ]
    };

    await db.insertSpace(testSpace);
    console.log('✅ Space created successfully\n');

    // Test 2: Retrieve the space
    console.log('Test 2: Retrieving the space...');
    const retrieved = await db.getSpace(testSpace.metadata.id);

    if (!retrieved) {
      throw new Error('Failed to retrieve space');
    }

    console.log('✅ Space retrieved:', {
      id: retrieved.metadata.id,
      title: retrieved.metadata.title,
      nodeCount: Object.keys(retrieved.nodes).length,
      historyCount: retrieved.globalHistory.length
    });
    console.log('');

    // Test 3: Verify data integrity
    console.log('Test 3: Verifying data integrity...');
    if (retrieved.metadata.title !== testSpace.metadata.title) {
      throw new Error('Title mismatch');
    }
    if (Object.keys(retrieved.nodes).length !== Object.keys(testSpace.nodes).length) {
      throw new Error('Node count mismatch');
    }
    if (retrieved.globalHistory.length !== testSpace.globalHistory.length) {
      throw new Error('History count mismatch');
    }
    console.log('✅ Data integrity verified\n');

    // Test 4: List spaces
    console.log('Test 4: Listing all spaces...');
    const spaces = await db.listSpaces();
    console.log(`✅ Found ${spaces.length} space(s):`);
    for (const space of spaces) {
      console.log(`   - ${space.title} (${space.nodeCount} nodes)`);
    }
    console.log('');

    // Test 5: Update space
    console.log('Test 5: Updating space...');
    const updatedSpace = {
      ...retrieved,
      metadata: {
        ...retrieved.metadata,
        title: 'Updated Test Space'
      },
      nodes: {
        ...retrieved.nodes,
        'TestNode3': {
          id: 'TestNode3',
          meanings: [{ content: 'Third node', confidence: 0.95, timestamp: Date.now() }],
          values: {},
          relationships: [],
          history: ['Added in update']
        }
      },
      globalHistory: [
        ...retrieved.globalHistory,
        'TestNode3 added'
      ]
    };

    await db.insertSpace(updatedSpace);
    const afterUpdate = await db.getSpace(testSpace.metadata.id);

    if (!afterUpdate) {
      throw new Error('Failed to retrieve updated space');
    }

    console.log('✅ Space updated:', {
      newTitle: afterUpdate.metadata.title,
      nodeCount: Object.keys(afterUpdate.nodes).length,
      historyCount: afterUpdate.globalHistory.length
    });
    console.log('');

    // Test 6: Delete space
    console.log('Test 6: Deleting space...');
    const deleted = await db.deleteSpace(testSpace.metadata.id);

    if (!deleted) {
      throw new Error('Failed to delete space');
    }

    console.log('✅ Space deleted\n');

    // Test 7: Verify deletion
    console.log('Test 7: Verifying deletion...');
    const afterDelete = await db.getSpace(testSpace.metadata.id);

    if (afterDelete !== null) {
      throw new Error('Space still exists after deletion');
    }

    console.log('✅ Deletion verified\n');

    console.log('🎉 All tests passed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

runTests();
