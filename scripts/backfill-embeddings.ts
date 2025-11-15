#!/usr/bin/env tsx

/**
 * Backfill embeddings for existing spaces and nodes that don't have them yet.
 *
 * This script:
 * 1. Finds all spaces without embeddings
 * 2. Generates embeddings for their titles and descriptions
 * 3. Finds all nodes without embeddings
 * 4. Generates embeddings for node titles and full content
 *
 * Usage:
 *   npx tsx scripts/backfill-embeddings.ts
 *
 * Environment variables (from .env file or shell):
 *   TURSO_DATABASE_URL - Database URL (default: file:modeler.db)
 *   TURSO_AUTH_TOKEN - Auth token for remote database
 *   TURSO_SYNC_URL - Sync URL for embedded replicas
 *   OPENAI_API_KEY - Required for embedding generation
 */

import { config } from 'dotenv';
import { TursoDatabase } from '../src/lib/turso-graph';

// Load environment variables from .env file
config();

async function backfillEmbeddings() {
  console.log('Starting embeddings backfill...\n');

  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.error('✗ Error: OPENAI_API_KEY is required for embedding generation');
    console.error('Please set it in your .env file or environment\n');
    process.exit(1);
  }

  // Initialize database with vector search enabled
  // Note: TursoDatabase automatically uses offline:true for embedded replicas (fast local writes)
  // Changes will sync to remote in the background via TURSO_SYNC_INTERVAL
  const db = new TursoDatabase({
    url: process.env.TURSO_DATABASE_URL || 'file:modeler.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
    syncUrl: process.env.TURSO_SYNC_URL,
    enableVectorSearch: true,
    syncInterval: 0  // Disable auto-sync during backfill, we'll sync manually at the end
  });

  try {
    // Get all spaces
    console.log('Fetching all spaces...');
    const spaces = await db.listSpaces();
    console.log(`Found ${spaces.length} spaces\n`);

    if (spaces.length === 0) {
      console.log('No spaces to backfill. Exiting.\n');
      return;
    }

    let spacesProcessed = 0;
    let spacesSkipped = 0;
    let nodesProcessed = 0;

    for (const spaceInfo of spaces) {
      console.log(`\n[${spaceInfo.id}] ${spaceInfo.title}`);

      const stepTimes: Record<string, number> = {};
      let lastTime = Date.now();

      // Load full space data
      const space = await db.getSpace(spaceInfo.id);
      stepTimes['fetch'] = Date.now() - lastTime;
      lastTime = Date.now();

      if (!space) {
        console.log('  ⚠ Space not found, skipping');
        spacesSkipped++;
        continue;
      }

      // Re-insert the space (this will trigger embedding generation)
      // The insertSpace method handles both space and node embeddings
      try {
        await db.insertSpace(space);
        stepTimes['insert+embed'] = Date.now() - lastTime;

        spacesProcessed++;
        nodesProcessed += Object.keys(space.nodes).length;

        const nodeCount = Object.keys(space.nodes).length;
        console.log(`  ✓ Updated space with ${nodeCount} nodes`);
        console.log(`  ⏱  Fetch: ${stepTimes['fetch']}ms, Insert+Embed: ${stepTimes['insert+embed']}ms`);
      } catch (error: any) {
        console.error(`  ✗ Failed to update space: ${error.message}`);
        spacesSkipped++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Backfill Summary:');
    console.log('='.repeat(60));
    console.log(`Spaces processed: ${spacesProcessed}`);
    console.log(`Spaces skipped:   ${spacesSkipped}`);
    console.log(`Nodes processed:  ${nodesProcessed}`);
    console.log('='.repeat(60) + '\n');

    console.log('✓ Backfill completed successfully!\n');

    // Manually sync all changes to remote
    if (process.env.TURSO_SYNC_URL && db.isReplica()) {
      console.log('Syncing all changes to remote database...');
      try {
        await db.sync();
        console.log('✓ Sync to remote completed\n');
      } catch (error) {
        console.error('⚠ Sync failed:', error);
        console.log('Your local database has all the embeddings, but they may not be on remote yet.');
        console.log('Try manually syncing later or check your network connection.');
      }
    }

  } catch (error) {
    console.error('\n✗ Backfill failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

backfillEmbeddings();
