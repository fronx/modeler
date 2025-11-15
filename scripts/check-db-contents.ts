#!/usr/bin/env npx tsx
/**
 * Check database contents using libSQL client
 */

import { createClient } from '@libsql/client';

async function checkDatabase() {
  const client = createClient({
    url: 'file:modeler.db'
  });

  console.log('=== Checking Database Contents ===\n');

  // Count spaces
  const spacesResult = await client.execute('SELECT COUNT(*) as count FROM spaces');
  console.log(`Spaces: ${spacesResult.rows[0].count}`);

  // Count nodes
  const nodesResult = await client.execute('SELECT COUNT(*) as count FROM nodes');
  console.log(`Nodes: ${nodesResult.rows[0].count}`);

  // Count edges
  const edgesResult = await client.execute('SELECT COUNT(*) as count FROM edges');
  console.log(`Edges: ${edgesResult.rows[0].count}\n`);

  // Sample a few nodes to check for relationships
  const sampleNodes = await client.execute(`
    SELECT space_id, node_key, data
    FROM nodes
    LIMIT 5
  `);

  console.log('=== Sample Nodes ===');
  for (const row of sampleNodes.rows) {
    const data = JSON.parse(row.data as string);
    const hasRelationships = data.relationships && data.relationships.length > 0;
    console.log(`${row.space_id}:${row.node_key} - Has relationships: ${hasRelationships}`);
    if (hasRelationships) {
      console.log(`  Relationships:`, data.relationships);
    }
  }

  client.close();
}

checkDatabase().catch(console.error);
