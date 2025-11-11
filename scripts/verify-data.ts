#!/usr/bin/env npx tsx

/**
 * Verify current database contents
 *
 * Shows all spaces and counts for nodes/history
 *
 * Usage: npx tsx scripts/verify-data.ts
 */

import { createClient } from "@libsql/client";
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(process.cwd(), '.env') });

async function verify() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:modeler.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
    syncUrl: process.env.TURSO_SYNC_URL
  });

  const spaces = await client.execute('SELECT id, title FROM spaces ORDER BY created_at');
  const nodesCount = await client.execute('SELECT COUNT(*) as count FROM nodes');
  const historyCount = await client.execute('SELECT COUNT(*) as count FROM history');

  console.log('\nCurrent Database Contents:');
  console.log('='.repeat(60));
  console.log(`\nSpaces (${spaces.rows.length}):`);
  for (const space of spaces.rows) {
    console.log(`  - ${space.title} (${space.id})`);
  }

  console.log(`\nNodes: ${nodesCount.rows[0].count}`);
  console.log(`History: ${historyCount.rows[0].count}`);

  client.close();
}

verify();
