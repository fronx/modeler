#!/usr/bin/env tsx

/**
 * Test script for Phase 2 vector search functionality
 *
 * Prerequisites:
 * 1. Run: npx tsx scripts/migrate-add-vectors.ts
 * 2. Set: ENABLE_VECTOR_SEARCH=true
 * 3. Set: OPENAI_API_KEY=your-key
 *
 * Usage:
 *   npx tsx test-vector-search.ts
 */

import { TursoDatabase } from './src/lib/turso-graph';
import type { CognitiveSpace } from './src/lib/turso-graph';

// Test data - sample cognitive spaces
const testSpaces: CognitiveSpace[] = [
  {
    metadata: {
      id: 'test-trust',
      title: 'Trust and Evidence',
      description: 'Exploring the relationship between trust and evidence in belief formation',
      createdAt: Date.now()
    },
    nodes: {
      Trust: {
        id: 'Trust',
        meanings: [
          {
            content: 'Reliance on something without complete verification. A cognitive shortcut that enables action under uncertainty.',
            confidence: 0.9,
            timestamp: Date.now()
          }
        ],
        values: { importance: 0.8, fragility: 0.7 },
        relationships: [],
        history: []
      },
      Evidence: {
        id: 'Evidence',
        meanings: [
          {
            content: 'Information that supports or refutes a claim. The foundation of rational belief.',
            confidence: 0.85,
            timestamp: Date.now()
          }
        ],
        values: { strength: 0.9, availability: 0.6 },
        relationships: [],
        history: []
      }
    },
    globalHistory: ['Space created', 'Trust node added', 'Evidence node added']
  },
  {
    metadata: {
      id: 'test-learning',
      title: 'Learning and Memory',
      description: 'How organisms acquire, store, and retrieve information',
      createdAt: Date.now()
    },
    nodes: {
      Encoding: {
        id: 'Encoding',
        meanings: [
          {
            content: 'The process of converting sensory information into memory traces. Initial registration of information.',
            confidence: 0.88,
            timestamp: Date.now()
          }
        ],
        values: { efficiency: 0.7, attention_required: 0.9 },
        relationships: [],
        history: []
      },
      Retrieval: {
        id: 'Retrieval',
        meanings: [
          {
            content: 'Accessing stored information from memory. The act of bringing memories back to consciousness.',
            confidence: 0.82,
            timestamp: Date.now()
          }
        ],
        values: { accuracy: 0.6, context_dependency: 0.85 },
        relationships: [],
        history: []
      }
    },
    globalHistory: ['Space created', 'Encoding node added', 'Retrieval node added']
  }
];

async function testVectorSearch() {
  console.log('🧪 Testing Vector Search Functionality\n');
  console.log('======================================\n');

  // Check environment
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not set');
    process.exit(1);
  }

  const db = new TursoDatabase({ enableVectorSearch: true });

  try {
    // Test 1: Insert spaces with embeddings
    console.log('📝 Test 1: Inserting test spaces with embeddings...\n');
    for (const space of testSpaces) {
      console.log(`   Inserting "${space.metadata.title}"...`);
      await db.insertSpace(space);
      console.log(`   ✓ Inserted with auto-generated embeddings\n`);
    }

    // Small delay to ensure embeddings are written
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Search spaces by semantic similarity
    console.log('🔍 Test 2: Semantic space search...\n');

    const spaceQueries = [
      'belief and verification',
      'cognition and information storage',
      'memory processes'
    ];

    for (const query of spaceQueries) {
      console.log(`   Query: "${query}"`);
      const results = await db.searchSpaces(query, 3);

      if (results.length === 0) {
        console.log('   ⚠️  No results found\n');
        continue;
      }

      console.log(`   Found ${results.length} results:\n`);
      for (const result of results) {
        console.log(`      ${result.title}`);
        console.log(`      Similarity: ${(result.similarity * 100).toFixed(1)}% | Distance: ${result.distance.toFixed(3)}`);
        console.log(`      ${result.description}\n`);
      }
    }

    // Test 3: Search nodes across all spaces
    console.log('🔍 Test 3: Global node search...\n');

    const nodeQueries = [
      'information processing',
      'belief without proof',
      'accessing stored data'
    ];

    for (const query of nodeQueries) {
      console.log(`   Query: "${query}"`);
      const results = await db.searchAllNodes(query, 3, 0.4);

      if (results.length === 0) {
        console.log('   ⚠️  No results found\n');
        continue;
      }

      console.log(`   Found ${results.length} results:\n`);
      for (const result of results) {
        console.log(`      Node: ${result.nodeKey} (Space: ${result.spaceId})`);
        console.log(`      Similarity: ${(result.similarity * 100).toFixed(1)}%`);
        console.log(`      Content: ${result.content.substring(0, 100)}...\n`);
      }
    }

    // Test 4: Search nodes within specific space
    console.log('🔍 Test 4: Space-specific node search...\n');

    const spaceSpecificQuery = 'cognitive shortcuts';
    const targetSpace = 'test-trust';

    console.log(`   Query: "${spaceSpecificQuery}" in space "${targetSpace}"`);
    const results = await db.searchNodesInSpace(targetSpace, spaceSpecificQuery, 3, 0.3);

    if (results.length === 0) {
      console.log('   ⚠️  No results found\n');
    } else {
      console.log(`   Found ${results.length} results:\n`);
      for (const result of results) {
        console.log(`      Node: ${result.nodeKey}`);
        console.log(`      Similarity: ${(result.similarity * 100).toFixed(1)}%`);
        console.log(`      Content: ${result.content.substring(0, 100)}...\n`);
      }
    }

    // Cleanup
    console.log('🧹 Cleanup: Removing test spaces...\n');
    for (const space of testSpaces) {
      await db.deleteSpace(space.metadata.id);
      console.log(`   ✓ Deleted "${space.metadata.title}"`);
    }

    console.log('\n✅ All tests completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run tests
testVectorSearch();
