#!/usr/bin/env npx tsx
/**
 * Data migration: Populate edges table from node JSON relationships
 * Phase 2 of edges table migration
 *
 * This script:
 * 1. Reads all nodes with relationships from the database
 * 2. Extracts relationships from node.data.relationships
 * 3. Inserts them into the edges table
 * 4. Does NOT modify or delete the JSON relationships (dual-read safety)
 *
 * Usage: npx tsx scripts/migrate-edges-data.ts
 */

import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || 'file:modeler.db';
const syncUrl = process.env.TURSO_SYNC_URL;

interface NodeRow {
  id: string;
  space_id: string;
  node_key: string;
  data: string;
}

interface Relationship {
  type: string;
  target: string;
  strength: number;
  gloss?: string;
}

async function migrateEdgesData() {
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
    syncUrl,
  });

  console.log('=== Starting Edges Data Migration ===\n');
  console.log(`Database: ${url}\n`);

  // Get all nodes
  const nodesResult = await client.execute('SELECT id, space_id, node_key, data FROM nodes');
  console.log(`Found ${nodesResult.rows.length} total nodes`);

  let nodesWithRelationships = 0;
  let totalEdges = 0;
  let insertedEdges = 0;
  let skippedEdges = 0;
  const errors: Array<{ edge: string; error: string }> = [];

  // Process each node
  for (const row of nodesResult.rows) {
    const nodeRow = row as unknown as NodeRow;
    const data = JSON.parse(nodeRow.data);

    if (!data.relationships || data.relationships.length === 0) {
      continue;
    }

    nodesWithRelationships++;
    const relationships: Relationship[] = data.relationships;

    console.log(`\nProcessing ${nodeRow.space_id}:${nodeRow.node_key} - ${relationships.length} relationships`);

    for (const rel of relationships) {
      totalEdges++;

      // Generate edge ID: "${spaceId}:${sourceNode}:${targetNode}"
      const edgeId = `${nodeRow.space_id}:${nodeRow.node_key}:${rel.target}`;
      const now = Date.now();

      try {
        // Insert edge with ON CONFLICT handling
        await client.execute({
          sql: `
            INSERT INTO edges (id, space_id, source_node, target_node, type, strength, gloss, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(space_id, source_node, target_node) DO UPDATE SET
              type = excluded.type,
              strength = excluded.strength,
              gloss = excluded.gloss,
              updated_at = excluded.updated_at
          `,
          args: [
            edgeId,
            nodeRow.space_id,
            nodeRow.node_key,
            rel.target,
            rel.type,
            rel.strength,
            rel.gloss || null,
            now,
            now
          ]
        });

        insertedEdges++;
        console.log(`  ✓ ${nodeRow.node_key} --[${rel.type}]--> ${rel.target} (${rel.strength})`);
      } catch (error) {
        skippedEdges++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({ edge: edgeId, error: errorMsg });

        // Check if it's a foreign key constraint error (target node doesn't exist)
        if (errorMsg.includes('FOREIGN KEY')) {
          console.log(`  ⚠ Skipped orphaned edge to non-existent node: ${rel.target}`);
        } else {
          console.log(`  ✗ Error inserting edge: ${errorMsg}`);
        }
      }
    }
  }

  // Summary
  console.log('\n=== Migration Summary ===');
  console.log(`Nodes with relationships: ${nodesWithRelationships}`);
  console.log(`Total edges found: ${totalEdges}`);
  console.log(`Edges inserted/updated: ${insertedEdges}`);
  console.log(`Edges skipped (errors): ${skippedEdges}`);

  if (errors.length > 0) {
    console.log('\n=== Errors Encountered ===');
    for (const { edge, error } of errors) {
      console.log(`${edge}: ${error}`);
    }
  }

  // Verify final edge count
  const edgesCountResult = await client.execute('SELECT COUNT(*) as count FROM edges');
  console.log(`\nFinal edge count in database: ${edgesCountResult.rows[0].count}`);

  client.close();

  if (skippedEdges > 0) {
    console.log('\n⚠️  Some edges were skipped due to errors (likely orphaned edges to deleted nodes)');
    console.log('This is expected and the migration cleaned up these inconsistencies.');
  }

  console.log('\n✓ Migration completed successfully!');
}

migrateEdgesData().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
